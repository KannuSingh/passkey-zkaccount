'use client'

import { Avatar, Button, Center, HStack, Icon, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverFooter, PopoverHeader, PopoverTrigger, Portal, Text, Tooltip, VStack, useBoolean, useClipboard, useColorModeValue, useToast } from "@chakra-ui/react";
import { FaCheckCircle, FaChevronDown, FaChevronRight, FaChevronUp, FaCopy, FaPowerOff, FaRedo } from "react-icons/fa"
import {  Contract, ethers } from "ethers"
import { BiWalletAlt } from "react-icons/bi"
import { useSession } from "@/hooks/useSession";
import { formatAddress, getNonceValue } from "@/utils";
import { useState } from "react";
import { Identity } from "@semaphore-protocol/identity"
import { Passkey } from "@/lib/passkey";
import { PasskeyXzkAccount } from "@/lib/passkeyXzkAccount";
import { logger } from "@/lib/logger";
import { useLocalStorage } from "usehooks-ts";
import { getBlockExplorerURLByChainId, getDemoNFTContractAddressByChainId, getEntryPointContractAddressByChainId, getPimlicoChainNameByChainId } from "@/lib/config";
import generateProof from "@/lib/zkSessionAccountProof";

export default function UserProfile() {
  const toast = useToast();
  const [isAccountDetailOpen, setIsAccountDetailOpen] = useBoolean()
  const [ethBalance,setEthBalance] = useState('0')
  const _portalBg = useColorModeValue("white", "gray.900")
	const _portalBorderBg = useColorModeValue("gray.200", "gray.700")
  const { onCopy, value, setValue:setWalletAddress, hasCopied } = useClipboard("");
  const [usernamePasskeyInfoMap,]= useLocalStorage("usernamePasskeyInfoMap",{})
  const {setSession,userAddress,identity,username} = useSession()
  const [isLoading,setLoading] = useState(false)

  const handleDisconnect = async () => {
    setLoading(true)
    try{
      if (usernamePasskeyInfoMap[username] && usernamePasskeyInfoMap[username].publicKeyAsHex) {
      const publicKey = Passkey.hex2buf(usernamePasskeyInfoMap[username].publicKeyAsHex);

      const provider = new ethers.JsonRpcProvider('https://goerli.base.org');
      const publicKeyAsCryptoKey = await Passkey.importPublicKeyAsCryptoKey(  publicKey );
      
      const [pubKeyX,pubKeyY] = await Passkey.getPublicKeyXYCoordinate(publicKeyAsCryptoKey)
      const passkeyId = ethers.encodeBytes32String("someIdentifier");
      const chainId = '0x14a33' //"0x"+BigInt((await provider.getNetwork()).chainId).toString(16)
      const passkeyXzkAccount = new PasskeyXzkAccount(provider,passkeyId,pubKeyX,pubKeyY)
      await passkeyXzkAccount.initialize()
      const [address,initCode ] = await passkeyXzkAccount.getUserPasskeyZkAccountAddress()
      logger.debug("smart contract account address: ",address)
      logger.debug("smart contract account initcode: ",initCode)
    
      const passkeyZkAccountContract = passkeyXzkAccount.getPasskeyZkAccountContract(address)
      const nftContractAddress = getDemoNFTContractAddressByChainId(chainId);
      // Prepare calldata to mint NFT
      const savedIdentity = new Identity(identity);
      const session={
        sessionCommitment:savedIdentity.commitment.toString(),
        validAfter:Math.round(Date.now()/1000),
        validUntil:Math.round(Date.now()/1000)
      }
      // LogIn session is tied to the NFT minting application 
      let callData = passkeyZkAccountContract.interface.encodeFunctionData("setSessionForApplication",[nftContractAddress,session])
      
      // const to =  nftContractAddress!;
      // const value = ethers.parseEther('0')
      // const demoNFTContracts = getDemoNFTContract(nftContractAddress!,provider) 
      // const mintingCall = demoNFTContracts.interface.encodeFunctionData("mintNFT",[address,metadataFile])
      // const data = mintingCall
      // let callData = passkeyZkAccount.interface.encodeFunctionData("execute", [to, value,data])

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
        setSession(session)
        toast({
          title: "Successfully ended session",
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
  }
  const handleCopyWalletAddress = () => {
    setWalletAddress(userAddress)
    onCopy()
  }

  return (
    <Popover isOpen={isAccountDetailOpen} onOpen={setIsAccountDetailOpen.on} onClose={setIsAccountDetailOpen.off}
      placement="bottom-end" isLazy
    >
      <PopoverTrigger>
        <Button  bg="none"
          leftIcon={ <Avatar size="sm" /> }
          rightIcon={
            isAccountDetailOpen ? (
              <Icon w={3} h={3} as={FaChevronUp} />
            ) : (
              <Icon w={3} h={3} as={FaChevronDown} />
            )
          }
          variant="ghost"
          _focus={{ boxShadow: "none", background: "none" }}
          _hover={{ background: "none" }}
        >
          {username}
        </Button>
      </PopoverTrigger>
      <Portal>
        <PopoverContent bg={_portalBg} borderColor={_portalBorderBg}>
          <PopoverArrow />
          <PopoverHeader borderBottomWidth="0px">
            <HStack justify="space-between">
              <HStack>
                <Icon aria-label="wallet" as={BiWalletAlt} />
                <Text> {formatAddress(userAddress)}
                </Text>
              </HStack>
              <HStack spacing="1">
              <Tooltip hasArrow label={hasCopied?'Copied':'Copy'} >
                <Button size="sm" onClick={handleCopyWalletAddress}>
                  <Icon w={3} h={3} as={FaCopy} />
                </Button>
              </Tooltip>
                
                <Button
                  isLoading={isLoading}
                  onClick={handleDisconnect}
                  colorScheme="red"
                  size="sm"
                >
                  <Icon w={3} h={3} as={FaPowerOff} />
                </Button>
              </HStack>
            </HStack>
          </PopoverHeader>
          <PopoverBody>
            <Center>
              <VStack spacing="1">
                <Text fontSize="2xl">{ethBalance}</Text>
                <Text fontSize="3xl">ETH</Text>
              </VStack>
            </Center>
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
}
