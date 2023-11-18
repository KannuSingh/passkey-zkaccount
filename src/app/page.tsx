'use client'

import Image from 'next/image'
import { Avatar, Box, Button, ButtonGroup, Container, Divider, Flex, HStack, Heading, Icon, List, ListItem, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, OrderedList, Spacer, Stack, Text, createIcon, useColorMode, useColorModeValue, useDisclosure, useToast } from '@chakra-ui/react'
import UserRegistrationModal from '@/components/PasskeyCreationModal';
import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { BiLinkExternal } from "react-icons/bi";
import { Link } from '@chakra-ui/next-js';
import UserLoginModal from '@/components/UserLoginModal';
import { logger } from '@/lib/logger';
import { Passkey } from '@/lib/passkey';
import { Identity } from "@semaphore-protocol/identity"
import { PasskeyXzkAccount} from '@/lib/passkeyXzkAccount';
import { useLocalStorage } from "usehooks-ts";
import {  Contract, ethers } from "ethers"
import { getBlockExplorerURLByChainId, getDemoNFTContractAddressByChainId, getEntryPointContractAddressByChainId, getPimlicoChainNameByChainId } from '@/lib/config';
import { useSession } from '@/hooks/useSession';
import { formatTime, getNonceValue } from '../utils';
import { getDemoNFTContract } from '@/lib/demoNFT';
import generateProof from '@/lib/zkSessionAccountProof';
import UserProfile from '@/components/UserProfile';
import { useState } from 'react';

export default function Home() {
  const toast = useToast();
  const { colorMode, toggleColorMode } = useColorMode()
  const { isOpen:isOpenRegisterModal, onOpen:onOpenRegisterModal, onClose:onCloseRegisterModal } = useDisclosure()
  const { isOpen:isOpenLoginModal, onOpen:onOpenLoginModal, onClose:onCloseLoginModal } = useDisclosure()
  const { isOpen:isLearnMoreModalOpen,  onOpen:onOpenLearnMoreModal, onClose:onCloseLearnMoreModal } = useDisclosure()
  const [usernamePasskeyInfoMap,]= useLocalStorage("usernamePasskeyInfoMap",{})
  const {session,timeRemaining,identity,username} = useSession()
  const [isLoading,setLoading] = useState(false)
  const [txLink,setTxLink] = useState<string>()

  const handleMint = async () => {
    setLoading(true)
    try{
      if (usernamePasskeyInfoMap[username] && usernamePasskeyInfoMap[username].publicKeyAsHex) {
      const publicKey = Passkey.hex2buf(usernamePasskeyInfoMap[username].publicKeyAsHex);

      const provider = new ethers.JsonRpcProvider('https://goerli.base.org');
      const metadataFile = 'bafybeifyl3g3wr24zqlxplb37zzxykk6crcl6wbvn7fcpi3rwnnerqzjpm'
      const publicKeyAsCryptoKey = await Passkey.importPublicKeyAsCryptoKey(  publicKey );
      
      const [pubKeyX,pubKeyY] = await Passkey.getPublicKeyXYCoordinate(publicKeyAsCryptoKey)
      
      const passkeyId = ethers.toUtf8Bytes(usernamePasskeyInfoMap[username].credentialId)

      const chainId = '0x14a33' //"0x"+BigInt((await provider.getNetwork()).chainId).toString(16)
      const passkeyXzkAccount = new PasskeyXzkAccount(provider,passkeyId,pubKeyX,pubKeyY)
      await passkeyXzkAccount.initialize()
      const [address,initCode ] = await passkeyXzkAccount.getUserPasskeyZkAccountAddress()
      logger.debug("smart contract account address: ",address)
      logger.debug("smart contract account initcode: ",initCode)
    
      const passkeyZkAccount = passkeyXzkAccount.getPasskeyZkAccountContract(address)
      const nftContractAddress = getDemoNFTContractAddressByChainId(chainId);
      // Prepare calldata to mint NFT
      const to =  nftContractAddress!;
      const value = ethers.parseEther('0')
      const demoNFTContracts = getDemoNFTContract(nftContractAddress!,provider) 
      const mintingCall = demoNFTContracts.interface.encodeFunctionData("mintNFT",[address,metadataFile])
      const data = mintingCall
      let callData = passkeyZkAccount.interface.encodeFunctionData("execute", [to, value,data])
      logger.debug("Generated callData:", callData)
      const gasPrice = (await provider.getFeeData()).gasPrice
      logger.debug("Gas Price",gasPrice)

      
      if (provider == null) throw new Error('must have entryPoint to autofill nonce')
      const c = new Contract(address, [`function getNonce() view returns(uint256)`], provider)
      const nonceValue = await getNonceValue(c)
      const chain = getPimlicoChainNameByChainId(chainId) // find the list of chain names on the Pimlico verifying paymaster reference page
      const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY
      const pimlicoEndpoint = `https://api.pimlico.io/v1/${chain}/rpc?apikey=${apiKey}`
      const pimlicoProvider = new ethers.JsonRpcProvider(pimlicoEndpoint,null,{staticNetwork:await provider.getNetwork()})
      const entryPointContractAddress = getEntryPointContractAddressByChainId(chainId)!// '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
      const userOperation = {
        sender: address,
        nonce:"0x"+nonceValue.toString(16),
        initCode:nonceValue === 0?initCode:'0x',
        callData,
        callGasLimit: "0x"+BigInt(2000000).toString(16), // hardcode it for now at a high value
        verificationGasLimit: "0x"+BigInt(2000000).toString(16), // hardcode it for now at a high value
        preVerificationGas: "0x"+BigInt(2000000).toString(16), // hardcode it for now at a high value
        maxFeePerGas: "0x"+gasPrice.toString(16),
        maxPriorityFeePerGas: "0x"+gasPrice.toString(16),
        paymasterAndData: "0x",
        signature: "0x"
      }
      const sponsorUserOperationResult = await pimlicoProvider.send("pm_sponsorUserOperation", [
        userOperation,
        {
          entryPoint: entryPointContractAddress,
        },
      ])
         
      const paymasterAndData = sponsorUserOperationResult.paymasterAndData
      logger.debug(`PaymasterAndData: ${paymasterAndData}`)
      if (paymasterAndData && session.sessionCommitment){
        const savedIdentity = new Identity(identity);
        userOperation.paymasterAndData = paymasterAndData
        const userOpHash = await passkeyXzkAccount._entryPoint.getUserOpHash(userOperation)
        const nullifier = savedIdentity.nullifier;
        const trapdoor = savedIdentity.trapdoor;
        const externalNullifier =  BigInt(userOpHash) >> BigInt(8) //BigInt(solidityKeccak256(['bytes'],[calldataHash])) >> BigInt(8)
        const {proof,publicSignals} = await generateProof(trapdoor,nullifier,externalNullifier)
        const sessionProof: any[8] = proof
        const proofInput: any[3] = publicSignals
        const argv = sessionProof.map((x:any) => BigInt(x))
        const hexStrings = argv.map((n:BigInt) => '0x' + n.toString(16));
        const sessionMode = '0x00000001' // '0x00000001' for session mode, '0x00000000' for direct signature mode
        // Encode the array of hex strings
        const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder()
        const encodedSessionProof = defaultAbiCoder.encode(['bytes4','address','uint256','uint256[8]'], [sessionMode,nftContractAddress,proofInput[1],hexStrings]);
        userOperation.signature = encodedSessionProof
        logger.debug(userOperation)

        // SUBMIT THE USER OPERATION TO BE BUNDLED
        const userOperationHash = await pimlicoProvider.send("eth_sendUserOperation", [
          userOperation,
          entryPointContractAddress // ENTRY_POINT_ADDRESS
        ])
        logger.debug("UserOperation hash:", userOperationHash)
        // let's also wait for the userOperation to be included, by continually querying for the receipts
        logger.debug("Querying for receipts...")
        let receipt = null
        while (receipt === null) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          receipt = await pimlicoProvider.send("eth_getUserOperationReceipt", [
          userOperationHash,
        ]);
          logger.debug(receipt === null ? "Still waiting..." : receipt)
        }

        const txHash = receipt.receipt.transactionHash
        const blockExplorer = getBlockExplorerURLByChainId(chainId)
        logger.debug(`UserOperation included: ${blockExplorer}/tx/${txHash}`)
        setTxLink(`${blockExplorer}/tx/${txHash}`)
        toast({
          title: "Successfully minted DEMO NFT",
          description: "",
          status: "success",
          duration: 9000,
          isClosable: true,
        })
        } else {
        logger.debug('Invalid PaymasterAndData.');
      }  

    }}catch(e){
      logger.error(e)
    }
   setLoading(false)
  };

  return (
    <Container maxW='6xl'>
      {/* Nav bar */}
      <Flex minWidth='max-content' p={2} alignItems='center' gap='2'>
        <Box py='2'>
          <Heading size='md' fontFamily={"monospace"}>Passkey X zkAccount</Heading>
        </Box>
        <Spacer />
        {timeRemaining
          && <>
            <Text>
              {formatTime(timeRemaining)}
            </Text>
            <UserProfile/>
          </>
        }
        
        
        <Button onClick={toggleColorMode}>
          {colorMode === "light" ? <MoonIcon /> : <SunIcon color="icon"/>}
        </Button>
      </Flex>

      <Divider orientation='horizontal' />

      {/* body */}
      <Flex direction={"column"} minH={"100vh"} p={2}  >
        <Container maxW={'3xl'}>
          <Stack
            as={Box}
            textAlign={'center'}
            spacing={{ base: 8, md: 14 }}
            py={{ base: 16, md: 28 }}>
            <Heading
              fontWeight={600}
              fontSize={{ base: '2xl', sm: '4xl', md: '6xl' }}
              lineHeight={'110%'}>
              Passkey{" "}
              <Text as={'span'} color={'green.400'}>
                X{" "}
              </Text>
              zkAccount
            </Heading>
            <Stack textAlign={'start'} spacing={5}>
              <Stack spacing={2}>
                <Text >
                  {`Passkey X zk account is an ERC-4337 account that incorporates two powerful authorization mechanisms, Secp256r1 signatures and zero-knowledge proofs of commitment Id.`}
                </Text>
                <Text>
                  {`Use of zk commitment id ensures a secure and seamless user experience without relying on any third-party session key intermediaries. `}
                  <Button variant={'link'} colorScheme={'blue'} size={'sm'} onClick={onOpenLearnMoreModal}>
                    Learn more
                  </Button>
                </Text>
              </Stack>
              {session  
                ?<Stack
                  direction={'column'}
                  spacing={3}
                  align={'center'}
                  alignSelf={'center'}
                  position={'relative'}>
                    <Button
                      isLoading = {isLoading}
                      colorScheme={'green'}
                      bg={'green.400'}
                      rounded={'full'}
                      px={6}
                      onClick={handleMint}
                      _hover={{
                        bg: 'green.500',
                      }}>
                      MintNFT
                    </Button>
                    {txLink && <Link href={txLink} isExternal>
                                Transaction link <Icon as={BiLinkExternal} mx='2px' />
                              </Link> }
                </Stack>
                :<Stack
                  direction={'column'}
                  spacing={3}
                  align={'center'}
                  alignSelf={'center'}
                  position={'relative'}>
                    <Stack direction={"row"}>
                      <Button colorScheme={'green'}  bg={'green.400'}
                        rounded={'full'} px={6} onClick={onOpenRegisterModal} 
                        _hover={{  bg: 'green.500', }}>
                        Create Passkey
                      </Button>
                      {/* <Button colorScheme={'green'}  bg={'green.400'}
                        rounded={'full'} px={6}
                        onClick={handlePasskeyAccountCreation}
                        _hover={{ bg: 'green.500', }}>
                        Sign up
                      </Button> */}
                      <Button
                        colorScheme={'green'}
                        bg={'green.400'}
                        rounded={'full'}
                        px={6}
                        onClick={onOpenLoginModal}
                        _hover={{
                          bg: 'green.500',
                        }}>
                        Login w/Passkey
                      </Button>
                    </Stack>
                    
                </Stack>
              }
              
            </Stack>
          </Stack>
          <UserRegistrationModal isOpen={isOpenRegisterModal} onOpen={onOpenRegisterModal} onClose={onCloseRegisterModal} />
          <UserLoginModal isOpen={isOpenLoginModal} onOpen={onOpenLoginModal} onClose={onCloseLoginModal} />
          <LearnMoreContent isOpen={isLearnMoreModalOpen} onClose={onCloseLearnMoreModal} />
        
        
        
        
        {/* footer */} 
        <Flex direction={"column"} alignItems={"center"} gap={2}>
          <Text textAlign={'center'} mt={4}>
            {`Explore this application as a practical example showcasing a passkey and zk 
            commitmentId smart contract account. Reach out to `}<Text as={'b'}>{`@kdsinghsaini`}</Text>
            {` on Telegram or Twitter for any feedback.`}
          </Text>
          
          <Text> Sponsored By{' '}
            <Link href="https://www.pimlico.io" color='blue.400' _hover={{ color: 'blue.500' }}>
              Pimlico
            </Link>
          </Text>
          <Box bgColor={useColorModeValue('gray.800', '')} p={2}>
            <Image
              src="/pimlico.svg"
              alt="Pimlico Logo"
              width={116}
              height={28}
            />
          </Box>
          <HStack>
            <Text>{`References:`}</Text>
              <Link href="https://github.com/0xjjpa/passkeys-is" isExternal>
                0xjjpa (Passkeys.is)
              </Link>
            
              <Link href="https://github.com/daimo-eth/p256-verifier" isExternal>
                Daimo (P256-verifier)
              </Link>
            </HStack>
        </Flex>
        </Container>
      </Flex>
    </Container>
  )
}


const LearnMoreContent = ({isOpen,onClose}:{isOpen:boolean,onClose():void}) => (

  <Modal isOpen={isOpen} onClose={onClose} size="2xl">
    <ModalOverlay />
    <ModalContent>
      <ModalHeader>Learn More</ModalHeader>
      <ModalCloseButton />
      <ModalBody>
        <Stack spacing={3}>
          <Text mt={4} textAlign={'start'}>
            {`Passkey X zk account is an ERC-4337 account that incorporates two powerful authorization mechanisms:`}
          </Text>
          <OrderedList spacing={2}>
            <ListItem>
              <Text as='b'>{`Passkeys with Secp256r1 Signatures:`}</Text>
              {` Passkeys use Secp256r1 signatures, verified on-chain through the Daimo p256-verifier .`}
            </ListItem>
            <ListItem>
              <Text as='b'>{`zkCommitment Proof for Time-Limited Interactions:`}</Text>
              {` The account introduces zkCommitment, where a commitment ID is generated for a specific DApp smart contract, such as a Demo NFT contract. This commitment ID, along with a designated time frame, creates a structure reminiscent of a session, similar to the concept commonly found in web2 applications. The account can seamlessly interact with the DApp smart contract by generating a proof for the commitment ID within its validity period. Notably, these interactions occur without the need for additional signature operations using the Passkey, providing both a secure and user-friendly experience.`}
            </ListItem>
          </OrderedList>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button colorScheme='red' mr={3} onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </ModalContent>
  </Modal>
);