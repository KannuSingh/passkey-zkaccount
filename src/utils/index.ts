import { logger } from '@/lib/logger';
import {Contract} from 'ethers'

export const formatTime = (seconds:number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  let formattedTime = '';

  if (hours > 0) {
    formattedTime += `${hours}h `;
  }

  if (minutes > 0) {
    formattedTime += `${minutes}m `;
  }

  if (remainingSeconds > 0 || formattedTime === '') {
    formattedTime += `${remainingSeconds}s`;
  }

  return formattedTime.trim();
};


export const getNonceValue = async (c:Contract) => {
  let nonceValue = 0;
  try {
    nonceValue = await c['getNonce']();
    
  } catch (error) {
    logger.info("Error fetching nonce:", error);
  }finally{
    return nonceValue
  }
}

export function formatAddress(address:string){
  return `${address.toString().substring(0, 6)}...${address.toString().substring(38)}`
}

// const handlePasskeyAccountCreation = async () =>{
//   if (publicKeyAsHexString) {
//     const publicKey = Passkey.hex2buf(publicKeyAsHexString);
//     const publicKeyAsCryptoKey = await Passkey.importPublicKeyAsCryptoKey(  publicKey );
    
//     const [pubKeyX,pubKeyY] = await Passkey.getPublicKeyXYCoordinate(publicKeyAsCryptoKey)
//     const passkeyId = ethers.encodeBytes32String("someIdentifier");
    
//     const provider = new ethers.JsonRpcProvider('https://goerli.base.org');
//     const passkeyXzkAccount = new PasskeyXzkAccount(provider,passkeyId,pubKeyX,pubKeyY)
//     await passkeyXzkAccount.initialize()
//     const [address,initCode ] = await passkeyXzkAccount.getUserPasskeyZkAccountAddress()
//     logger.info("smart contract account address: ",address)
//     logger.info("smart contract account initcode: ",initCode)
  
//     const passkeyZkAccount = passkeyXzkAccount.getPasskeyZkAccountContract(address)
//     const gasPrice = (await provider.getFeeData()).gasPrice
//     logger.info("Gas Price",gasPrice)

    
//     if (provider == null) throw new Error('must have entryPoint to autofill nonce')
//     const c = new Contract(address, [`function getNonce() view returns(uint256)`], provider)
//     const nonceValue = await getNonceValue(c)
//     const chainId = '0x14a33' //"0x"+BigInt((await provider.getNetwork()).chainId).toString(16)
//     const callData = "0x"
//     const chain = getPimlicoChainNameByChainId(chainId) // find the list of chain names on the Pimlico verifying paymaster reference page
//     const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY
//     const pimlicoEndpoint = `https://api.pimlico.io/v1/${chain}/rpc?apikey=${apiKey}`
//     const pimlicoProvider = new ethers.JsonRpcProvider(pimlicoEndpoint,null,{staticNetwork:await provider.getNetwork()})
//     const entryPointContractAddress = getEntryPointContractAddressByChainId(chainId)!// '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
//     const userOperation = {
//       sender: address,
//       nonce:"0x"+nonceValue.toString(16),
//       initCode:nonceValue === 0?initCode:'0x',
//       callData,
//       callGasLimit: "0x"+BigInt(2000000).toString(16), // hardcode it for now at a high value
//       verificationGasLimit: "0x"+BigInt(2000000).toString(16), // hardcode it for now at a high value
//       preVerificationGas: "0x"+BigInt(2000000).toString(16), // hardcode it for now at a high value
//       maxFeePerGas: "0x"+gasPrice.toString(16),
//       maxPriorityFeePerGas: "0x"+gasPrice.toString(16),
//       paymasterAndData: "0x",
//       signature: "0x"
//     }

//     logger.info("UserOperation",userOperation)
//     logger.info("Waiting paymaster signature...")
//     const sponsorUserOperationResult = await pimlicoProvider.send("pm_sponsorUserOperation", [
//       userOperation,
//       {
//         entryPoint: entryPointContractAddress,
//       },
//     ])
//     const paymasterAndData = sponsorUserOperationResult.paymasterAndData
//     logger.info(`paymasterAndData: ${paymasterAndData}`)
    
//     logger.info("Sponsored userOperation:",sponsorUserOperationResult)
//     if (paymasterAndData){
//       userOperation.paymasterAndData = paymasterAndData
//       const userOpHash = await passkeyXzkAccount._entryPoint.getUserOpHash(userOperation)
//       logger.info("Waiting user signature...")

//       const {authenticatorData,clientDataJson,
//         challengeLocation,requireUserVerification,
//         responseTypeLocation,r,s,error} = await Passkey.getPasskeySignatureData(userOpHash,{})
//       // const signature = await signer.signMessage( ethers.arrayify(userOpHash))
//       if(error == null){
//         const sessionMode = '0x00000000'
//         const defaultAbiCoder = ethers.AbiCoder.defaultAbiCoder()
//         const passKeySignatureStruct = defaultAbiCoder.encode([
//           'tuple(uint256,uint256,uint256,uint256,bool,bytes,string)'],
//            [ [challengeLocation,
//             responseTypeLocation,
//             r,
//             s,
//             requireUserVerification,
//             authenticatorData,
//             clientDataJson]]).substring(2)
//         logger.info("SignatureStruct: ",passKeySignatureStruct)
//         const encodedSignature =  defaultAbiCoder.encode(['bytes4'],[sessionMode])+passKeySignatureStruct
//         logger.info("Final Signature",encodedSignature)

//         userOperation.signature = encodedSignature
//         logger.info(userOperation)
      
//         // SUBMIT THE USER OPERATION TO BE BUNDLED
//         const userOperationHash = await pimlicoProvider.send("eth_sendUserOperation", [
//           userOperation,
//           entryPointContractAddress // ENTRY_POINT_ADDRESS
//         ])
//         logger.info("UserOperation hash:", userOperationHash)
//         logger.info("Waiting userOperation receipt...")
//         // let's also wait for the userOperation to be included, by continually querying for the receipts
//         logger.info("Querying for receipts...")
//         let receipt = null
//         while (receipt === null) {
//           await new Promise((resolve) => setTimeout(resolve, 1000))
//           receipt = await pimlicoProvider.send("eth_getUserOperationReceipt", [
//           userOperationHash,
//         ]);
//           logger.info(receipt === null ? "Still waiting..." : receipt)
//         }

//         const txHash = receipt.receipt.transactionHash
//         const blockExplorer = getBlockExplorerURLByChainId(chainId)
//         logger.info(`UserOperation included: ${blockExplorer}/tx/${txHash}`)
//         toast(
//           {
//             title: "Successfully started session",
//             description: "",
//             status: "success",
//             duration: 9000,
//             isClosable: true,
//           })
//       }
//       else{
//         logger.error("(🪪,❌) Error", error);
//         toast({
//           title: "Error retrieving assertion.",
//           description: error,
//           status: "error",
//           duration: 9000,
//           isClosable: true,
//         });
//       }
//     } else {
//       logger.error('Invalid PaymasterAndData.');
//     }
//   }
// }