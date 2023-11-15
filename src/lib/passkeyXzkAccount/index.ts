import { config } from "@/lib/config";
import {  Contract, ethers } from "ethers"
import {PasskeyZkAccount} from "./types/Passkey_X_ZkAccount.sol"
import {PasskeyZkAccountFactory} from "./types/Passkey_X_ZkAccountFactory.sol"
import ENTRY_POINT_ABI from "./abis/EntryPoint.json"
import PASSKEY_ZK_ACCOUNT_FACTORY_ABI from "./abis/passkey_X_zkAccount_Factory.json"
import PASSKEY_ZK_ACCOUNT_ABI from "./abis/passkey_X_zkAccount.json"
import { EntryPoint } from "./types/EntryPoint";
import { logger } from "../logger";

// GENERATE THE INITCODE
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"

export class PasskeyXzkAccount {
   
    _entryPoint: EntryPoint;
    _signerOrProvider: ethers.Provider | ethers.Signer
    _pubKeyX:string
    _pubKeyY:string
    _passKeyId:string
    _passkeyZkAccountFactoryAddress: string
    _passkeyZkAccountFactory: PasskeyZkAccountFactory;

    /**
     * @notice Create PaymasterApplicationsRegistry instance to interact with
     * @param signerOrProvider signer or provider to use
     */
    constructor(signerOrProvider: ethers.Provider | ethers.Signer, passkeyId:string, pubKeyX:string,pubKeyY:string ) {
        this._pubKeyX = pubKeyX
        this._pubKeyY = pubKeyY
        this._passKeyId = passkeyId
        this._entryPoint = new Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, signerOrProvider) as unknown as EntryPoint
        this._signerOrProvider = signerOrProvider
    }

    async initialize(){
        let chainId = (await this._signerOrProvider.provider.getNetwork()).chainId
        let chainConfig = config["0x"+chainId.toString(16)]
        if(chainConfig.passkeyZkAccountFactory || chainConfig.passkeyZkAccountFactory!=""){
            this._passkeyZkAccountFactoryAddress = chainConfig.passkeyZkAccountFactory
            this._passkeyZkAccountFactory =  new Contract(chainConfig.passkeyZkAccountFactory, PASSKEY_ZK_ACCOUNT_FACTORY_ABI, this._signerOrProvider) as unknown as PasskeyZkAccountFactory
        }else{
            logger.error("No PasskeyXzkAccount factory deployed on chain",chainId)
            throw new Error(`No PasskeyXzkAccount factory deployed on chain ${chainId}`)
        }
    }
    async getUserPasskeyZkAccountAddress(): Promise<[address:string,initCode:string]>  {
        logger.debug(this._passkeyZkAccountFactory)
        try{
            const initCode = ethers.concat([
                this._passkeyZkAccountFactoryAddress,
                this._passkeyZkAccountFactory.interface.encodeFunctionData("createAccount", [this._passKeyId,this._pubKeyX,this._pubKeyY, 0]),
            ])
            
            // CALCULATE THE SENDER ADDRESS
            const senderAddress = await this._entryPoint.getSenderAddress.staticCall(initCode)
            .then(() => {
                throw new Error("Expected getSenderAddress() to revert");
            })
            .catch((e) => {
                const data = e.data.match(/0x6ca7b806([a-fA-F\d]*)/)?.[1];
                if (!data) {
                return Promise.reject(new Error("Failed to parse revert data"));
                }
                const addr = ethers.getAddress(`0x${data.slice(24, 64)}`);
                return Promise.resolve(addr);
            })
 
            console.log("Calculated sender address:", senderAddress)
            return [senderAddress,initCode]
        }catch(err){
            console.log(err)
        }
        return ['','']
    }

    getPasskeyZkAccountContract(address:string):PasskeyZkAccount {
       return  new Contract(address, PASSKEY_ZK_ACCOUNT_ABI, this._signerOrProvider) as unknown as PasskeyZkAccount 
    }
}
 
