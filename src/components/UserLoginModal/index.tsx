'use client'

import { logger } from '@/lib/logger';
import { Passkey } from '@/lib/passkey';
import { PasskeyXzkAccount} from '@/lib/passkeyXzkAccount';
import { Identity } from "@semaphore-protocol/identity"
import {  Modal, ModalOverlay, ModalContent, ModalHeader,  ModalFooter,  ModalBody, ModalCloseButton,  Button, Input, FormControl,  FormLabel, FormHelperText, useToast, RadioGroup,  HStack,  Radio, Select, Switch, FormErrorMessage, Text, } from '@chakra-ui/react'
import { useLocalStorage } from "usehooks-ts";
import { useEffect, useState } from 'react';
import {  Contract, ethers } from "ethers"
import { getBlockExplorerURLByChainId, getDemoNFTContractAddressByChainId, getEntryPointContractAddressByChainId, getPimlicoChainNameByChainId } from '@/lib/config';
import { useSession } from '@/hooks/useSession';
import { getNonceValue } from '@/utils';

interface IUserLoginModal{
  isOpen:boolean; 
  onOpen():void; 
  onClose():void; 
}

export default function UserLoginModal({ isOpen, onOpen, onClose }:IUserLoginModal) {
  const toast = useToast();
  const [sessionTimeInterval,setSessionTimeInterval] = useState(5)
  const [paymasterProvider,setPaymasterProvider] = useState('Pimlico')
  // const [rememberSettings, setRememberSettings] = useState(false);
  const {setSession, setIdentity,setUserAddress,setUsername:setSessionUsername} = useSession();
  const [usernamePasskeyInfoMap,setUsernamePasskeyInfoMap]= useLocalStorage("usernamePasskeyInfoMap",{})
  const [username,setUsername]= useState('')
  const [isLoading,setLoading] = useState(false)

  const handleLogin = async () =>{
    
    try{
      logger.debug(usernamePasskeyInfoMap[username])
      setLoading(true)
      if (usernamePasskeyInfoMap[username] && usernamePasskeyInfoMap[username].publicKeyAsHex) {
        
        const publicKey = Passkey.hex2buf(usernamePasskeyInfoMap[username].publicKeyAsHex);
        const publicKeyAsCryptoKey = await Passkey.importPublicKeyAsCryptoKey(  publicKey );
        
        const [pubKeyX,pubKeyY] = await Passkey.getPublicKeyXYCoordinate(publicKeyAsCryptoKey)
        const passkeyId = ethers.toUtf8Bytes(usernamePasskeyInfoMap[username].credentialId)
        
        const sessionStartTime = new Date(Date.now());
        const sessionEndTime = (new Date( Date.now() + sessionTimeInterval*60*1000))
        
        // this create random commitment Id for the session
        const identity = new Identity();
        setIdentity(identity.toString())

        const session={
          sessionCommitment:identity.commitment.toString(),
          validAfter:Math.round(sessionStartTime.getTime()/1000),
          validUntil:Math.round(sessionEndTime.getTime()/1000)
        }
      

        const provider = new ethers.JsonRpcProvider('https://goerli.base.org');
        const chainId = '0x14a33' //"0x"+BigInt((await provider.getNetwork()).chainId).toString(16)
        const passkeyXzkAccount = new PasskeyXzkAccount(provider,passkeyId,pubKeyX,pubKeyY)
        await passkeyXzkAccount.initialize()
        const [address,initCode ] = await passkeyXzkAccount.getUserPasskeyZkAccountAddress()
        
        logger.debug("Log-in user account address: ",address)
        logger.debug("Log-in user smart contract account initcode: ",initCode)

        const passkeyZkAccountContract = passkeyXzkAccount.getPasskeyZkAccountContract(address)

        const nftContractAddress = getDemoNFTContractAddressByChainId(chainId)

        // LogIn session is tied to the NFT minting application 
        let callData = passkeyZkAccountContract.interface.encodeFunctionData("setSessionForApplication",[nftContractAddress,session])
        logger.debug("Calldata for setting session for the mintNFT application: ",callData)

        const gasPrice = (await provider.getFeeData()).gasPrice
        
        if (provider == null) throw new Error('must have entryPoint to autofill nonce')
        const c = new Contract(address, [`function getNonce() view returns(uint256)`], provider)
        const nonceValue = await getNonceValue(c)
        
        const chain = getPimlicoChainNameByChainId(chainId) 
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
        logger.debug("UserOperation : ",userOperation)
        logger.debug("Waiting paymaster signature...")
        const sponsorUserOperationResult = await pimlicoProvider.send("pm_sponsorUserOperation", [
          userOperation,
          {
            entryPoint: entryPointContractAddress,
          },
        ])
        const paymasterAndData = sponsorUserOperationResult.paymasterAndData
        logger.debug('paymasterAndData received: ',paymasterAndData)
        
        if (paymasterAndData){
          userOperation.paymasterAndData = paymasterAndData
          const userOpHash = await passkeyXzkAccount._entryPoint.getUserOpHash(userOperation)
          logger.debug("Waiting user to sign userOperation...")
          const allowCredentials:PublicKeyCredentialDescriptor[] = [{
            id:Passkey.parseBase64url(usernamePasskeyInfoMap[username].credentialRawId),
            type:'public-key'
          }]
          logger.debug(allowCredentials)
          const {authenticatorData,clientDataJson,
            challengeLocation,requireUserVerification,
            responseTypeLocation,r,s,error} = await Passkey.getPasskeySignatureData(userOpHash,allowCredentials)
            
            if(error == null){
              // session mode(0x000000) indicate signing with passkey 
              const sessionMode = '0x00000000'
              const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder()
              const passKeySignatureStruct = defaultAbiCoder.encode([
                'tuple(uint256,uint256,uint256,uint256,bool,bytes,string)'],
                [ [challengeLocation,
                  responseTypeLocation,
                  r,
                  s,
                  requireUserVerification,
                  authenticatorData,
                  clientDataJson]]).substring(2)
              
              const encodedSignature =  defaultAbiCoder.encode(['bytes4'],[sessionMode])+passKeySignatureStruct
              logger.debug("UserOp Signature: ",encodedSignature)

              userOperation.signature = encodedSignature
              logger.debug("Final UserOperation: ",userOperation)
            
              // SUBMIT THE USER OPERATION TO BE BUNDLED
              const userOperationHash = await pimlicoProvider.send("eth_sendUserOperation", [
                userOperation,
                entryPointContractAddress // ENTRY_POINT_ADDRESS
              ])

              logger.debug("UserOperation hash:", userOperationHash)
              logger.debug("Waiting userOperation receipt...")
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
              
              // close the login modal
              onClose()
              setSession(session)
              setUserAddress(address)
              setSessionUsername(username)
              toast({ title: "Successfully started session",
                description: "", status: "success",
                duration: 9000, isClosable: true
              });

            } else{
              logger.error("(🪪,❌) Error", error);
              toast({ title: "Error retrieving assertion.",
                description: error, status: "error",
                duration: 9000,  isClosable: true,
              });
            }
        } else {
          toast({ title: "Error retrieving gas fee sponsorship from paymaster.",
              description:"", status: "error",
              duration: 9000,  isClosable: true,
            });
          logger.error('Error retrieving gas fee sponsorship from paymaster.');
        }
      } 
    }catch(e){
      toast({ title: "Some error occurred.",
        description:"", status: "error",
        duration: 9000,  isClosable: true,
      });
      
      console.error(e)
    }
    setLoading(false) 
  }
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Log-in Session Configuration</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl as='fieldset'>
            <FormLabel as='legend'>
              Select Paymaster
            </FormLabel>
            <RadioGroup value={paymasterProvider} onChange={(value) => setPaymasterProvider(value)}>
              <HStack spacing='24px'>
                <Radio value='Pimlico'>Pimlico</Radio>
                <Radio disabled value='Other'>Other</Radio>
              </HStack>
            </RadioGroup>
            <FormHelperText>{`Select other if you've a one.`}</FormHelperText>
          
            <FormLabel>Session Time</FormLabel>
            <Select placeholder='Select Session Time' 
                    value={sessionTimeInterval} 
                    onChange={(e) => setSessionTimeInterval(parseInt(e.target.value, 10))}
            >
              <option value={30}>30 Min</option>
              <option value={15}>15 Min</option>
              <option value={5}>5 Min</option>
            </Select>
            
            <FormLabel>Username</FormLabel>
            <Input type='email' value={username} onChange={(e) => {setUsername(e.target.value.toLowerCase())}}/>
            <FormHelperText>Enter username to identify your account.</FormHelperText>
            
            {/* <FormLabel htmlFor='remember-session-settings' mb='0'>
              Remember Settings?
            </FormLabel>
            <Switch id='remember-session-settings' /> */}
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button colorScheme='red' mr={3} onClick={onClose}>
            Close
          </Button>
          <Button isDisabled={username.trim()===''} 
            onClick={handleLogin} colorScheme='green'
            isLoading={isLoading}
            >Login</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

