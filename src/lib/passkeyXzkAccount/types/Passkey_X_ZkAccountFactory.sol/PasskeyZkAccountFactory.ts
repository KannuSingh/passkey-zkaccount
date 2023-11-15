/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumberish,
  BytesLike,
  FunctionFragment,
  Result,
  Interface,
  ContractRunner,
  ContractMethod,
  Listener,
} from "ethers";
import type {
  TypedContractEvent,
  TypedDeferredTopicFilter,
  TypedEventLog,
  TypedListener,
  TypedContractMethod,
} from "./../common";

export interface PasskeyZkAccountFactoryInterface extends Interface {
  getFunction(
    nameOrSignature:
      | "accountImplementation"
      | "createAccount"
      | "getCounterfactualAddress"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "accountImplementation",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "createAccount",
    values: [BytesLike, BigNumberish, BigNumberish, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "getCounterfactualAddress",
    values: [BytesLike, BigNumberish, BigNumberish, BigNumberish]
  ): string;

  decodeFunctionResult(
    functionFragment: "accountImplementation",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "createAccount",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getCounterfactualAddress",
    data: BytesLike
  ): Result;
}

export interface PasskeyZkAccountFactory extends BaseContract {
  connect(runner?: ContractRunner | null): PasskeyZkAccountFactory;
  waitForDeployment(): Promise<this>;

  interface: PasskeyZkAccountFactoryInterface;

  queryFilter<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;
  queryFilter<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEventLog<TCEvent>>>;

  on<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  on<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  once<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    listener: TypedListener<TCEvent>
  ): Promise<this>;
  once<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>
  ): Promise<this>;

  listeners<TCEvent extends TypedContractEvent>(
    event: TCEvent
  ): Promise<Array<TypedListener<TCEvent>>>;
  listeners(eventName?: string): Promise<Array<Listener>>;
  removeAllListeners<TCEvent extends TypedContractEvent>(
    event?: TCEvent
  ): Promise<this>;

  accountImplementation: TypedContractMethod<[], [string], "view">;

  createAccount: TypedContractMethod<
    [
      id: BytesLike,
      pubKeyX: BigNumberish,
      pubKeyY: BigNumberish,
      salt: BigNumberish
    ],
    [string],
    "nonpayable"
  >;

  getCounterfactualAddress: TypedContractMethod<
    [
      id: BytesLike,
      pubKeyX: BigNumberish,
      pubKeyY: BigNumberish,
      salt: BigNumberish
    ],
    [string],
    "view"
  >;

  getFunction<T extends ContractMethod = ContractMethod>(
    key: string | FunctionFragment
  ): T;

  getFunction(
    nameOrSignature: "accountImplementation"
  ): TypedContractMethod<[], [string], "view">;
  getFunction(
    nameOrSignature: "createAccount"
  ): TypedContractMethod<
    [
      id: BytesLike,
      pubKeyX: BigNumberish,
      pubKeyY: BigNumberish,
      salt: BigNumberish
    ],
    [string],
    "nonpayable"
  >;
  getFunction(
    nameOrSignature: "getCounterfactualAddress"
  ): TypedContractMethod<
    [
      id: BytesLike,
      pubKeyX: BigNumberish,
      pubKeyY: BigNumberish,
      salt: BigNumberish
    ],
    [string],
    "view"
  >;

  filters: {};
}
