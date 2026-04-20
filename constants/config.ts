import abi from "./abi.json";

import { CERTIFICATE_CONTRACT_ADDRESS } from "./address";

const DEFAULT_SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

export const CONTRACT_ADDRESS = CERTIFICATE_CONTRACT_ADDRESS;
export const CONTRACT_ABI = abi;

export const NETWORK_CONFIG = {
	chainName: "Sepolia",
	rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() || DEFAULT_SEPOLIA_RPC_URL,
} as const;