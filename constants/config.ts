// 1 admin
// import abi from "./abi.json";
// nhiều admin
import abi_2 from "./abi.json";

import { CERTIFICATE_CONTRACT_ADDRESS } from "./address";

const DEFAULT_SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

export const CONTRACT_ADDRESS = CERTIFICATE_CONTRACT_ADDRESS;
// 1 admin
// export const CONTRACT_ABI = abi;
// nhiều admin
export const CONTRACT_ABI = abi_2;

export const NETWORK_CONFIG = {
	chainName: "Sepolia",
	rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() || DEFAULT_SEPOLIA_RPC_URL,
} as const;