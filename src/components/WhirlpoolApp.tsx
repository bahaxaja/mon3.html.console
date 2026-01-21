"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  address,
  createSolanaRpc,
  isAddress
} from '@solana/kit';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction, TransactionInstruction, PublicKey } from '@solana/web3.js';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Decimal from 'decimal.js';
import { initializePositionBundle, loadAndDisplayBundle } from '@/lib/initbundle';
import { fetchPositionsForOwner } from '@orca-so/whirlpools';
import { getPoolData, getTokenSymbol, PoolData } from '@/lib/loadpoolinfo';
import { createPositionsWithLiquidity, signAndSendAllTransactions } from '@/lib/addLiquidityWithSwap';
import {
  validateWalletAddress,
  logAddressDebugInfo,
  logTokenConfig,
  logPositionParams,
  logWalletStatus,
  validatePositionCreationInputs
} from '@/lib/debugUtils';
import { FileBrowserContainer } from '@/lib/file-browser';
import * as Select from '@radix-ui/react-select';

// Types
type Dashboard = 'config' | 'search' | 'latest' | 'pda' | 'create-bundle' | 'view-bundle' | 'docs' | 'files' | 'logs';

interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  timestamp: Date;
}

export function WhirlpoolApp() {
  const { publicKey, signTransaction, sendTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  const [activeDashboard, setActiveDashboard] = useState<Dashboard>('config');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [env, setEnv] = useState<string>('');
  const [network, setNetwork] = useState<'mainnet' | 'devnet' | 'custom'>('devnet');
  const [rpcUrl, setRpcUrl] = useState<string>('https://api.devnet.solana.com');
  const [envRpcUrls, setEnvRpcUrls] = useState({ mainnet: '', devnet: '' });
  const [balance, setBalance] = useState<bigint>(0n);
  const [isLoading, setIsLoading] = useState(false);

  const [whirlpools, setWhirlpools] = useState<any[]>([]);
  const [latestWhirlpools, setLatestWhirlpools] = useState<any[]>([]);
  const [tokenASymbol, setTokenASymbol] = useState('');
  const [tokenBSymbol, setTokenBSymbol] = useState('');
  const [poolAddressInput, setPoolAddressInput] = useState('');
  const [selectedWhirlpool, setSelectedWhirlpool] = useState<any>(null);
  const [poolMetadata, setPoolMetadata] = useState<any>(null);
  const [tokenAInfo, setTokenAInfo] = useState<any>(null);
  const [tokenBInfo, setTokenBInfo] = useState<any>(null);
  const [lastTransactions, setLastTransactions] = useState<any[]>([]);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(160);
  const [isResizing, setIsResizing] = useState(false);
  const [consoleMinimized, setConsoleMinimized] = useState(false);
  const [rangePercent, setRangePercent] = useState<string>('0.1');
  const [numPositions, setNumPositions] = useState<string>('20');
  const [fundAmount, setFundAmount] = useState<string>('1');
  const [reinvestMode, setReinvestMode] = useState<string>('AUTO REINVEST');
  const [harvestMode, setHarvestMode] = useState<string>('WHEN PROFITABLE');
  const [bundleName, setBundleName] = useState<string>('');
  const [bundleSymbol, setBundleSymbol] = useState<string>('');
  const [bundleImagePreview, setBundleImagePreview] = useState<string>('');
  const [bundleUri, setBundleUri] = useState<string>('');
  const [positionBundles, setPositionBundles] = useState<any[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [nftAddressInput, setNftAddressInput] = useState<string>('');
  const [bundlePoolAddressInput, setBundlePoolAddressInput] = useState<string>('');
  const [loadedBundle, setLoadedBundle] = useState<any>(null);
  const [loadedPoolData, setLoadedPoolData] = useState<PoolData | null>(null);
  const [bundlePositionCount, setBundlePositionCount] = useState<number>(0);
  const [bundleLoading, setBundleLoading] = useState(false);

  const [minimizedBundles, setMinimizedBundles] = useState<Set<number>>(new Set());
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  const [positionDetails, setPositionDetails] = useState<Map<string, any>>(new Map());
  const [loadingPositions, setLoadingPositions] = useState<Set<string>>(new Set());
  const [defaultImageUrl, setDefaultImageUrl] = useState<string>('');
  const [editingDefaultImg, setEditingDefaultImg] = useState(false);
  const [tempDefaultImgUrl, setTempDefaultImgUrl] = useState('');
  const [imgEditMode, setImgEditMode] = useState<'from-saved' | 'browse' | 'load-url' | null>(null);
  const [savedImageKeys, setSavedImageKeys] = useState<{ key: string; value: string }[]>([]);
  const [imageChanged, setImageChanged] = useState(false);

  const togglePositionExpand = (bundleIdx: number, posIndex: number) => {
    const key = `${bundleIdx}-${posIndex}`;
    setExpandedPositions(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleBundleMinimize = (idx: number) => {
    setMinimizedBundles(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const logRef = useRef<HTMLDivElement>(null);

  const rpc = useMemo(() => createSolanaRpc(rpcUrl), [rpcUrl]);

  const TOKEN_MAP: Record<string, Record<string, string>> = {
    mainnet: {
      'SOL': 'So11111111111111111111111111111111111111112',
      'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    },
    devnet: {
      'SOL': 'So11111111111111111111111111111111111111112',
      'USDC': '8zGuJvS9mZc96F89GfEByvBky5z6Qonb8fS7Cba2pC9i',
      'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    }
  };

  const resolveMint = (symbolOrAddr: string) => {
    if (!symbolOrAddr) return null;
    if (isAddress(symbolOrAddr)) return symbolOrAddr;
    const upper = symbolOrAddr.toUpperCase();
    const net = network === 'mainnet' ? 'mainnet' : 'devnet';
    return TOKEN_MAP[net]?.[upper] || null;
  };

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const stopResizing = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    const handleResize = (e: MouseEvent) => {
      if (isResizing) {
        const newHeight = window.innerHeight - e.clientY;
        if (newHeight > 40 && newHeight < window.innerHeight * 0.8) {
          setConsoleHeight(newHeight);
        }
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, stopResizing]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(36), message, type, timestamp: new Date() }]);
  };

  // Calculate price from sqrtPriceX64 with token decimal adjustment
  // Default assumes tokenA=6 decimals (USDC), tokenB=9 decimals (SOL)
  const sqrtPriceToPrice = (sqrtPriceX64: bigint | string, decimalsA = 6, decimalsB = 9): Decimal => {
    const sqrtPrice = new Decimal(sqrtPriceX64.toString());
    const rawPrice = sqrtPrice.div(new Decimal(2).pow(64)).pow(2);
    const decimalAdjustment = new Decimal(10).pow(decimalsA - decimalsB);
    return rawPrice.mul(decimalAdjustment);
  };

  const copyToClipboard = (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
          addLog(`Copied to clipboard: ${text}`, 'success');
        }).catch(() => {
          fallbackCopy(text);
        });
      } else {
        fallbackCopy(text);
      }
    } catch (err) {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Ensure textarea is not visible but can be focused
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        addLog(`Copied to clipboard (fallback): ${text}`, 'success');
      } else {
        window.prompt("Manual Copy Required: Ctrl+C, Enter", text);
      }
    } catch (err) {
      window.prompt("Manual Copy Required: Ctrl+C, Enter", text);
    }
    document.body.removeChild(textArea);
  };

  const fetchLastTransactions = async (addressStr: string) => {
    try {
      const sigs = await rpc.getSignaturesForAddress(address(addressStr), { limit: 5 }).send();

      // Fetch full transactions to extract price if possible
      const fullTxs = await Promise.all(sigs.map(async (sig) => {
        try {
          const tx = await rpc.getTransaction(sig.signature, {
            encoding: 'json',
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          }).send();

          let price = null;
          if (tx && tx.meta && tx.meta.logMessages) {
            // Try to find price in logs: "Program log: price: 123.456"
            for (const log of tx.meta.logMessages) {
              if (log.includes('price:')) {
                const match = log.match(/price:\s*([\d.]+)/);
                if (match) price = match[1];
              }
            }
          }
          return { ...sig, price };
        } catch (e) {
          console.error('Failed to fetch tx details', e);
          return { ...sig, price: null };
        }
      }));

      setLastTransactions(fullTxs);
    } catch (err: any) {
      addLog(`Failed to fetch transactions: ${err.message}`, 'error');
    }
  };

  const loadPoolMetadata = async (pool: any) => {
    addLog(`Loading metadata for pool: ${pool.address}...`, 'info');
    setLastTransactions([]);
    setTokenAInfo(null);
    setTokenBInfo(null);
    try {
      const { fetchWhirlpool } = await import('@orca-so/whirlpools-client');
      const poolData = await fetchWhirlpool(rpc, address(pool.address));

      // Fetch token metadata for both tokens
      const tokenMintA = poolData?.data?.tokenMintA;
      const tokenMintB = poolData?.data?.tokenMintB;

      if (tokenMintA && tokenMintB) {
        addLog(`Fetching token info for ${tokenMintA} and ${tokenMintB}...`, 'info');

        // Fetch mint accounts to get decimals
        try {
          const [mintARes, mintBRes] = await Promise.all([
            rpc.getAccountInfo(address(tokenMintA), { encoding: 'base64' }).send(),
            rpc.getAccountInfo(address(tokenMintB), { encoding: 'base64' }).send()
          ]);

          // Parse mint data - decimals is at offset 44 in the mint account data
          const parseMintDecimals = (accountInfo: any): number => {
            if (!accountInfo?.value?.data?.[0]) return 0;
            const data = Buffer.from(accountInfo.value.data[0], 'base64');
            return data[44]; // decimals offset in mint account
          };

          const decimalsA = parseMintDecimals(mintARes);
          const decimalsB = parseMintDecimals(mintBRes);

          setTokenAInfo({ mint: tokenMintA, decimals: decimalsA });
          setTokenBInfo({ mint: tokenMintB, decimals: decimalsB });
          addLog(`Token A decimals: ${decimalsA}, Token B decimals: ${decimalsB}`, 'success');

          // Recalculate price with correct decimals
          const correctedPrice = sqrtPriceToPrice(poolData?.data?.sqrtPrice, decimalsA, decimalsB);
          const metadata = {
            ...poolData,
            price: correctedPrice,
            tickSpacing: pool.tickSpacing
          };
          setPoolMetadata(metadata);

          // Save complete pool info to temppool.json
          const data = poolData?.data;
          const feeRatePercent = data?.feeRate ? (Number(data.feeRate) / 10000).toFixed(2) + '%' : 'N/A';

          const poolCacheData = {
            address: pool.address,
            tickSpacing: data?.tickSpacing ?? pool.tickSpacing,
            currentPrice: correctedPrice.toFixed(6),
            currentTick: data?.tickCurrentIndex,
            tokenA: {
              mint: String(tokenMintA),
              symbol: getTokenSymbol(String(tokenMintA)),
              decimals: decimalsA
            },
            tokenB: {
              mint: String(tokenMintB),
              symbol: getTokenSymbol(String(tokenMintB)),
              decimals: decimalsB
            },
            liquidity: data?.liquidity ? String(data.liquidity) : null,
            feeRate: feeRatePercent,
            feeRateRaw: data?.feeRate,
            sqrtPrice: data?.sqrtPrice ? String(data.sqrtPrice) : null,
            tokenMintA: String(tokenMintA),
            tokenMintB: String(tokenMintB),
            tokenVaultA: data?.tokenVaultA ? String(data.tokenVaultA) : null,
            tokenVaultB: data?.tokenVaultB ? String(data.tokenVaultB) : null,
            whirlpoolsConfig: data?.whirlpoolsConfig ? String(data.whirlpoolsConfig) : null,
            whirlpoolBump: data?.whirlpoolBump,
            feeGrowthGlobalA: data?.feeGrowthGlobalA ? String(data.feeGrowthGlobalA) : null,
            feeGrowthGlobalB: data?.feeGrowthGlobalB ? String(data.feeGrowthGlobalB) : null,
            protocolFeeOwedA: data?.protocolFeeOwedA ? String(data.protocolFeeOwedA) : null,
            protocolFeeOwedB: data?.protocolFeeOwedB ? String(data.protocolFeeOwedB) : null,
            rewardLastUpdatedTimestamp: data?.rewardLastUpdatedTimestamp ? String(data.rewardLastUpdatedTimestamp) : null,
            rewardInfos: data?.rewardInfos?.map((r: any) => ({
              mint: r?.mint ? String(r.mint) : null,
              vault: r?.vault ? String(r.vault) : null,
              authority: r?.authority ? String(r.authority) : null,
              emissionsPerSecondX64: r?.emissionsPerSecondX64 ? String(r.emissionsPerSecondX64) : null,
              growthGlobalX64: r?.growthGlobalX64 ? String(r.growthGlobalX64) : null
            }))
          };

          try {
            const saveRes = await fetch('/api/pool-cache', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(poolCacheData)
            });
            const saveResult = await saveRes.json();
            addLog(`Pool info saved to temppool.json (${saveResult.poolCount} pools)`, 'success');

            // Log formatted pool data to GUI console
            const guiLog = [
              '--- POOL DATA SAVED ---',
              `ADDRESS: ${poolCacheData.address}`,
              `TICK SPACING: ${poolCacheData.tickSpacing}`,
              `CURRENT PRICE: ${poolCacheData.currentPrice}`,
              `CURRENT TICK: ${poolCacheData.currentTick}`,
              '',
              '--- Token Information ---',
              `TOKEN A: ${poolCacheData.tokenA.mint}`,
              `Decimals: ${poolCacheData.tokenA.decimals}`,
              `TOKEN B: ${poolCacheData.tokenB.mint}`,
              `Decimals: ${poolCacheData.tokenB.decimals}`,
              '',
              '--- Pool Stats ---',
              `LIQUIDITY: ${poolCacheData.liquidity}`,
              `FEE RATE: ${poolCacheData.feeRate}`,
              `TOKEN VAULT A: ${poolCacheData.tokenVaultA}`,
              `TOKEN VAULT B: ${poolCacheData.tokenVaultB}`,
              '-----------------------'
            ].join('\n');
            addLog(guiLog, 'info');

            // Log formatted pool data to console
            console.log('%c\n╔══════════════════════════════════════════════════════════╗', 'color: #06b6d4; font-weight: bold');
            console.log('%c║           POOL DATA SAVED TO TEMPPOOL.JSON               ║', 'color: #06b6d4; font-weight: bold');
            console.log('%c╚══════════════════════════════════════════════════════════╝', 'color: #06b6d4; font-weight: bold');
            console.log('%cADDRESS:', 'color: #a1a1aa; font-weight: bold', poolCacheData.address);
            console.log('%cTICK SPACING:', 'color: #a1a1aa; font-weight: bold', poolCacheData.tickSpacing);
            console.log('%cCURRENT PRICE:', 'color: #a1a1aa; font-weight: bold', poolCacheData.currentPrice);
            console.log('%cCURRENT TICK:', 'color: #a1a1aa; font-weight: bold', poolCacheData.currentTick);
            console.log('%c\n--- Token Information ---', 'color: #22c55e; font-weight: bold');
            console.log('%cTOKEN A:', 'color: #a1a1aa; font-weight: bold', poolCacheData.tokenA.mint);
            console.log('%c  Decimals:', 'color: #71717a', poolCacheData.tokenA.decimals);
            console.log('%cTOKEN B:', 'color: #a1a1aa; font-weight: bold', poolCacheData.tokenB.mint);
            console.log('%c  Decimals:', 'color: #71717a', poolCacheData.tokenB.decimals);
            console.log('%c\n--- Pool Stats ---', 'color: #22c55e; font-weight: bold');
            console.log('%cLIQUIDITY:', 'color: #a1a1aa; font-weight: bold', poolCacheData.liquidity);
            console.log('%cFEE RATE:', 'color: #a1a1aa; font-weight: bold', poolCacheData.feeRate);
            console.log('%cTOKEN VAULT A:', 'color: #a1a1aa; font-weight: bold', poolCacheData.tokenVaultA);
            console.log('%cTOKEN VAULT B:', 'color: #a1a1aa; font-weight: bold', poolCacheData.tokenVaultB);
            console.log('%c\n--- Full JSON ---', 'color: #eab308; font-weight: bold');
            console.log(JSON.stringify(poolCacheData, null, 2));
            console.log('%c═══════════════════════════════════════════════════════════\n', 'color: #06b6d4');
          } catch (cacheErr: any) {
            addLog(`Failed to cache pool info: ${cacheErr.message}`, 'warning');
          }
        } catch (tokenErr: any) {
          addLog(`Token info fetch failed: ${tokenErr.message}`, 'warning');
          setPoolMetadata({
            ...poolData,
            price: pool.price,
            tickSpacing: pool.tickSpacing
          });
        }
      } else {
        setPoolMetadata({
          ...poolData,
          price: pool.price,
          tickSpacing: pool.tickSpacing
        });
      }

      addLog(`Metadata loaded for ${pool.address}`, 'success');
      await fetchLastTransactions(pool.address);
    } catch (err: any) {
      addLog(`Metadata load failed: ${err.message}`, 'error');
    }
  };

  const handleSelectPool = async (pool: any) => {
    setSelectedWhirlpool(pool);
    await loadPoolMetadata(pool);

    // Fetch and print complete temppool.json file contents to console
    try {
      const cacheRes = await fetch('/api/pool-cache');
      const cacheData = await cacheRes.json();
      console.log('\n========== TEMPPOOL.JSON FILE CONTENTS ==========');
      console.log(JSON.stringify(cacheData, null, 2));
      console.log('=================================================\n');
    } catch (err) {
      console.error('Failed to fetch temppool.json:', err);
    }
  };

  useEffect(() => {

    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Load Balance
  useEffect(() => {
    if (publicKey && rpc) {
      let isMounted = true;
      const fetchBalance = async () => {
        if (!rpcUrl || !rpcUrl.startsWith('http')) return;
        try {
          const addr = address(publicKey.toBase58());
          const bal = await rpc.getBalance(addr).send();
          if (isMounted && bal && typeof bal.value === 'bigint') {
            setBalance(bal.value);
          }
        } catch (err: any) {
          if (!isMounted) return;
          console.error('Balance fetch failed', err);
          let errMsg = 'Unknown error';
          if (err && typeof err === 'object') {
            errMsg = err.message || JSON.stringify(err).substring(0, 100);
          } else {
            errMsg = String(err);
          }

          if (errMsg.includes('403') || errMsg.includes('Forbidden')) {
            addLog('RPC Access Forbidden (403). The current RPC node may be blocking requests. Try a different RPC URL.', 'error');
          } else if (errMsg.includes('length')) {
            addLog('RPC Error: Malformed response (length error). This usually indicates a transport or CORS issue with the RPC node.', 'error');
          } else {
            addLog(`Balance fetch failed: ${errMsg.substring(0, 100)}`, 'error');
          }
        }
      };
      fetchBalance();
      const interval = setInterval(fetchBalance, 10000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [publicKey, rpc, rpcUrl]);

  // Load .env
  const extractSavedImageKeys = (envContent: string): { key: string; value: string }[] => {
    // Find the #DEFAULT IMGS section and extract all image URLs
    const imageKeys: { key: string; value: string }[] = [];
    const lines = envContent.split('\n');
    let inImagesSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '#DEFAULT IMGS') {
        inImagesSection = true;
        continue;
      }
      if (inImagesSection && line.startsWith('#')) {
        break; // Another section started
      }
      if (inImagesSection && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          imageKeys.push({ key: key.trim(), value: value.trim() });
        }
      }
    }
    return imageKeys;
  };

  const loadEnv = async () => {
    try {
      addLog('Loading .env from server...', 'info');
      const res = await fetch('/api/env');
      const data = await res.json();
      if (data.env) {
        setEnv(data.env);

        let currentNetwork: 'mainnet' | 'devnet' | 'custom' = 'devnet';
        if (data.env.includes('NETWORK=mainnet')) {
          setNetwork('mainnet');
          currentNetwork = 'mainnet';
        } else if (data.env.includes('NETWORK=devnet')) {
          setNetwork('devnet');
          currentNetwork = 'devnet';
        } else if (data.env.includes('NETWORK=custom')) {
          setNetwork('custom');
          currentNetwork = 'custom';
        }

        // More precise regex for each network
        const rpcMainnetMatch = data.env.match(/RPC_MAINNET=([^\n]+)/) || data.env.match(/MAINNETRPC=([^\n]+)/);
        const rpcDevnetMatch = data.env.match(/RPC_DEVNET=([^\n]+)/) || data.env.match(/DEVNETRPC=([^\n]+)/);
        const customRpcMatch = data.env.match(/CUSTOM_RPC=([^\n]+)/);

        const mainnetRpc = rpcMainnetMatch ? rpcMainnetMatch[1].trim() : 'https://solana-rpc.publicnode.com';
        const devnetRpc = rpcDevnetMatch ? rpcDevnetMatch[1].trim() : 'https://api.devnet.solana.com';

        setEnvRpcUrls({
          mainnet: mainnetRpc,
          devnet: devnetRpc
        });

        if (currentNetwork === 'mainnet') {
          setRpcUrl(mainnetRpc);
        } else if (currentNetwork === 'devnet') {
          setRpcUrl(devnetRpc);
        } else if (currentNetwork === 'custom' && customRpcMatch && customRpcMatch[1].trim()) {
          setRpcUrl(customRpcMatch[1].trim());
        }

        const defaultImgMatch = data.env.match(/DEFAULTIMG=([^\n]+)/);
        if (defaultImgMatch && defaultImgMatch[1].trim()) {
          setDefaultImageUrl(defaultImgMatch[1].trim());
        }

        // Extract saved image keys from #DEFAULT IMGS section
        const imgKeys = extractSavedImageKeys(data.env);
        setSavedImageKeys(imgKeys);

        try {
          const { setWhirlpoolsConfig } = await import('@orca-so/whirlpools');
          await setWhirlpoolsConfig(currentNetwork === 'mainnet' ? "solanaMainnet" : "solanaDevnet");
          addLog(`Whirlpools config initialized for ${currentNetwork.toUpperCase()}`, 'success');
        } catch (err: any) {
          addLog(`Failed to initialize Whirlpools config: ${err.message}`, 'error');
        }

        addLog('.env loaded successfully', 'success');
      }
    } catch (err) {
      addLog('Failed to load .env', 'error');
    }
  };

  const handleNetworkChange = async (newNetwork: 'mainnet' | 'devnet' | 'custom') => {
    setNetwork(newNetwork);
    addLog(`Network changed to ${newNetwork.toUpperCase()}`, 'info');

    let newRpc = rpcUrl;
    if (newNetwork === 'mainnet') {
      newRpc = envRpcUrls.mainnet || 'https://solana-rpc.publicnode.com';
    } else if (newNetwork === 'devnet') {
      newRpc = envRpcUrls.devnet || 'https://api.devnet.solana.com';
    } else if (newNetwork === 'custom') {
      const input = window.prompt('Paste custom RPC URL:');
      if (input) {
        newRpc = input.trim();
      } else {
        addLog('No custom RPC URL provided, keeping current.', 'info');
      }
    }

    setRpcUrl(newRpc);

    try {
      const { setWhirlpoolsConfig } = await import('@orca-so/whirlpools');
      await setWhirlpoolsConfig(newNetwork === 'mainnet' ? "solanaMainnet" : "solanaDevnet");
      addLog(`Whirlpools config updated for ${newNetwork.toUpperCase()}`, 'success');
    } catch (err: any) {
      addLog(`Failed to update Whirlpools config: ${err.message}`, 'error');
    }
  };

  useEffect(() => {
    loadEnv();
  }, []);

  const testConfig = async () => {
    addLog('Testing Whirlpools Configuration...', 'info');
    setIsLoading(true);
    try {
      const { setWhirlpoolsConfig } = await import('@orca-so/whirlpools');
      await setWhirlpoolsConfig(network === 'mainnet' ? "solanaMainnet" : "solanaDevnet");
      addLog(`✓ Config set to ${network}`, 'success');

      addLog(`Testing connection to ${rpcUrl}...`, 'info');
      const health = await rpc.getHealth().send();
      addLog(`✓ RPC Health: ${health.value}`, 'success');

      if (publicKey) {
        addLog(`✓ Wallet Connected: ${publicKey.toBase58()}`, 'success');
      } else {
        addLog('! Wallet not connected, some features will be limited', 'info');
      }

      setIsLoading(false);
    } catch (err: any) {
      addLog(`Configuration test failed: ${err.message}`, 'error');
      setIsLoading(false);
    }
  };

  const saveEnv = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env }),
      });
      if (res.ok) addLog('Environment saved successfully', 'success');
      else addLog('Failed to save environment', 'error');
    } catch (err) {
      addLog('Error saving environment', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLatestPools = async () => {
    addLog('Fetching latest pools from network...', 'info');
    setIsLoading(true);
    try {
      const { setWhirlpoolsConfig } = await import('@orca-so/whirlpools');
      const { fetchAllWhirlpoolWithFilter, whirlpoolTokenMintAFilter } = await import('@orca-so/whirlpools-client');
      const { address } = await import('@solana/kit');

      await setWhirlpoolsConfig(network === 'mainnet' ? "solanaMainnet" : "solanaDevnet");

      const solMint = address('So11111111111111111111111111111111111111112');
      const filter = whirlpoolTokenMintAFilter(solMint);
      const pools = await fetchAllWhirlpoolWithFilter(rpc, filter);

      addLog(`Raw fetch returned ${pools?.length ?? 0} pools`, 'info');
      if (pools && pools.length > 0) {
        addLog(`First pool keys: ${Object.keys(pools[0]).join(', ')}`, 'info');
      }

      const sorted = (pools || []).sort((a: any, b: any) => (b.address || '').localeCompare(a.address || '')).slice(0, 20);

      const processed = sorted.map((p: any) => {
        try {
          const price = sqrtPriceToPrice(p.data.sqrtPrice);
          return { ...p, price };
        } catch (e) {
          return { ...p, price: new Decimal(0) };
        }
      });

      setLatestWhirlpools(processed);
      setWhirlpools(processed);
      addLog(`Fetched ${processed.length} pools from network`, 'success');
    } catch (err: any) {
      addLog(`Fetch failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const searchByAddress = async () => {
    if (!isAddress(poolAddressInput)) return addLog('Invalid Solana address', 'error');

    addLog(`Searching for pool by address: ${poolAddressInput}...`, 'info');
    setIsLoading(true);
    try {
      const { fetchWhirlpool } = await import('@orca-so/whirlpools-client');
      const { setWhirlpoolsConfig } = await import('@orca-so/whirlpools');
      await setWhirlpoolsConfig(network === 'mainnet' ? "solanaMainnet" : "solanaDevnet");

      const poolData = await fetchWhirlpool(rpc, address(poolAddressInput));
      if (poolData) {
        const price = sqrtPriceToPrice(poolData.data.sqrtPrice);
        const poolObj = {
          address: poolData.address,
          data: poolData.data,
          price,
          tickSpacing: poolData.data.tickSpacing
        };
        setWhirlpools([poolObj]);
        handleSelectPool(poolObj);
        addLog(`Pool found: ${poolAddressInput}`, 'success');
      } else {
        addLog('Pool not found at this address', 'error');
      }
    } catch (err: any) {
      addLog(`Search failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const searchPools = async () => {
    // Check if Token A is a pool address first if Token B is empty
    if (isAddress(tokenASymbol) && !tokenBSymbol) {
      addLog(`Checking if ${tokenASymbol} is a Whirlpool...`, 'info');
      try {
        const { fetchWhirlpool } = await import('@orca-so/whirlpools-client');
        const poolData = await fetchWhirlpool(rpc, address(tokenASymbol));
        if (poolData) {
          const price = sqrtPriceToPrice(poolData.data.sqrtPrice);
          const poolObj = {
            address: poolData.address,
            data: poolData.data,
            price,
            tickSpacing: poolData.data.tickSpacing
          };
          setWhirlpools([poolObj]);
          handleSelectPool(poolObj);
          addLog(`Found Whirlpool via address search: ${tokenASymbol}`, 'success');
          setIsLoading(false);
          return;
        }
      } catch { }
    }

    const mintA = resolveMint(tokenASymbol);
    const mintB = resolveMint(tokenBSymbol);

    addLog(`Searching for pools matching: ${tokenASymbol || '?'} / ${tokenBSymbol || '?'}...`, 'info');
    setIsLoading(true);
    try {
      const { setWhirlpoolsConfig, fetchWhirlpoolsByTokenPair } = await import('@orca-so/whirlpools');
      const {
        fetchAllWhirlpool,
        fetchAllWhirlpoolWithFilter,
        whirlpoolTokenMintAFilter,
        whirlpoolTokenMintBFilter
      } = await import('@orca-so/whirlpools-client');

      await setWhirlpoolsConfig(network === 'mainnet' ? "solanaMainnet" : "solanaDevnet");

      let pools: any[] = [];

      if (mintA && mintB) {
        addLog(`Fetching pools for token pair: ${mintA} / ${mintB}`, 'info');
        const results = await fetchWhirlpoolsByTokenPair(rpc, address(mintA), address(mintB));
        pools = results
          .filter(r => r.initialized && (r as any).whirlpool)
          .map(r => ({
            address: r.address,
            data: (r as any).whirlpool,
            tickSpacing: (r as any).whirlpool.tickSpacing
          }));
      } else if (mintA || mintB) {
        const queryMint = mintA || mintB;
        addLog(`Filtering by token address: ${queryMint}`, 'info');
        const filterA = whirlpoolTokenMintAFilter(address(queryMint!));
        const filterB = whirlpoolTokenMintBFilter(address(queryMint!));

        const [poolsA, poolsB] = await Promise.all([
          fetchAllWhirlpoolWithFilter(rpc, filterA),
          fetchAllWhirlpoolWithFilter(rpc, filterB)
        ]);
        pools = [...poolsA, ...poolsB];
      } else {
        pools = await fetchAllWhirlpool(rpc, {});
      }

      const filtered = pools.filter((p, index, self) => {
        if (!p || !p.address) return false;
        return self.findIndex(t => t && t.address === p.address) === index;
      }).slice(0, 10);

      const poolsWithPrice = filtered.map((p: any) => {
        try {
          const price = sqrtPriceToPrice(p.data.sqrtPrice);
          return { ...p, price };
        } catch {
          return { ...p, price: new Decimal(0) };
        }
      });

      setWhirlpools(poolsWithPrice);
      addLog(`Found ${poolsWithPrice.length} unique pools`, 'success');
    } catch (err: any) {
      addLog(`Search failed: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };


  const getProvider = () => {
    if ('phantom' in window) {
      const anyWindow: any = window;
      const provider = anyWindow.phantom?.solana;

      if (provider) {
        return provider;
      }
    }

    window.open('https://phantom.app/', '_blank');
  };


  const initializeBundle = async () => {
    if (!publicKey) return addLog('Connect wallet first', 'error');
    if (!selectedWhirlpool) return addLog('Select a whirlpool first', 'error');
    if (!sendTransaction) return addLog('Wallet does not support sending transactions', 'error');

    addLog('Initializing Position Bundle...', 'info');
    setIsLoading(true);
    try {
      await initializePositionBundle({
        publicKey,
        connection,
        selectedWhirlpool,
        sendTransaction,
        addLog,
      });
      setIsLoading(false);
    } catch (err: any) {
      addLog(`Initialization failed: ${err.message}`, 'error');
      console.error('Bundle init error:', err);
      setIsLoading(false);
    }
  };


  useEffect(() => {
    if (activeDashboard === 'latest') {
      fetchLatestPools();
    }
  }, [activeDashboard]);

  const loadBundleByNft = async () => {
    if (!nftAddressInput || !isAddress(nftAddressInput)) {
      addLog('Please enter a valid NFT address', 'error');
      return;
    }

    setBundleLoading(true);
    addLog(`Loading bundle from NFT: ${nftAddressInput}...`, 'info');

    try {
      let bundleFileData = null;

      try {
        const bundleCacheRes = await fetch(`/api/bundle-cache?mint=${nftAddressInput}`);
        if (bundleCacheRes.ok) {
          bundleFileData = await bundleCacheRes.json();
          addLog(`Found bundle file: public/style/${nftAddressInput}.json`, 'success');
        }
      } catch (fileErr) {
        addLog(`No local bundle file found`, 'info');
      }

      if (bundleFileData) {
        setLoadedBundle({ data: bundleFileData });
        addLog(`Bundle loaded from file: ${bundleFileData.positionCount || 0} positions`, 'success');
        addLog(`RAW BUNDLE DATA:\n${JSON.stringify(bundleFileData, (key, value) => typeof value === 'bigint' ? value.toString() : value instanceof Uint8Array ? Array.from(value) : value, 2)}`, 'info');
        setBundlePositionCount(bundleFileData.positionCount || 0);

        const poolAddr = bundleFileData.poolInfo?.address || bundleFileData.whirlpool;

        if (poolAddr) {
          addLog(`Fetching current pool data for: ${poolAddr}...`, 'info');
          try {
            const poolData = await getPoolData(poolAddr, rpcUrl, network);
            setLoadedPoolData(poolData);
            addLog(`Pool data loaded: ${poolData.tokenA.symbol}/${poolData.tokenB.symbol} @ ${poolData.currentPrice.toFixed(6)}`, 'success');
          } catch (poolErr: any) {
            addLog(`Could not fetch live pool data: ${poolErr.message}`, 'error');
            if (bundleFileData.poolInfo) {
              const p = bundleFileData.poolInfo;
              const tokenA = p.tokenA || { mint: '', symbol: 'A', decimals: 9 };
              const tokenB = p.tokenB || { mint: '', symbol: 'B', decimals: 6 };

              // Ensure symbol fields exist (use known token map lookup if mint present)
              if ((!tokenA.symbol || tokenA.symbol === '') && tokenA.mint) {
                tokenA.symbol = getTokenSymbol(String(tokenA.mint));
              }
              if ((!tokenB.symbol || tokenB.symbol === '') && tokenB.mint) {
                tokenB.symbol = getTokenSymbol(String(tokenB.mint));
              }

              setLoadedPoolData({
                address: p.address,
                tokenA,
                tokenB,
                currentPrice: parseFloat(p.currentPrice) || 0,
                tickSpacing: p.tickSpacing || 0,
                currentTick: p.currentTick || 0,
                sqrtPrice: p.sqrtPrice || '0',
                liquidity: p.liquidity || '0',
                feeRate: p.feeRateRaw || 0
              });
              addLog(`Using cached pool info from bundle file`, 'info');
            }
          }
        } else {
          addLog('Bundle has no pool associated. Select a pool to add positions.', 'info');
          setLoadedPoolData(null);
        }
      } else {
        addLog(`No bundle file found for ${nftAddressInput}. Make sure to initialize the bundle first.`, 'error');
        setLoadedBundle(null);
        setLoadedPoolData(null);
        setBundlePositionCount(0);
      }
    } catch (err: any) {
      addLog(`Failed to load bundle: ${err.message}`, 'error');
      setLoadedBundle(null);
      setLoadedPoolData(null);
      setBundlePositionCount(0);
    } finally {
      setBundleLoading(false);
    }
  };

  const handleDeleteBundle = async (bundleIdx: number) => {
    try {
      console.log('Delete clicked, index:', bundleIdx);
      console.log('positionBundles:', positionBundles);

      const bundle = positionBundles[bundleIdx];
      console.log('Selected bundle:', bundle);

      if (!bundle) {
        addLog('Bundle not found at index ' + bundleIdx, 'error');
        return;
      }

      if (!publicKey) {
        addLog('Connect wallet first', 'error');
        return;
      }

      if (bundle.occupiedCount > 0) {
        addLog(`Cannot delete bundle with open positions (${bundle.occupiedCount}/256 occupied)`, 'error');
        return;
      }

      setIsLoading(true);
      const { getAssociatedTokenAddressSync } = await import('@solana/spl-token');

      const bundleMint = bundle.data?.positionBundleMint;
      const bundleAddress = bundle.address;

      console.log('bundleMint:', bundleMint, typeof bundleMint);
      console.log('bundleAddress:', bundleAddress, typeof bundleAddress);

      if (!bundleMint || !bundleAddress) {
        throw new Error(`Missing bundle mint or address: mint=${bundleMint}, address=${bundleAddress}`);
      }

      // Convert addresses to proper format
      const bundleAddressStr = typeof bundleAddress === 'string' ? bundleAddress : bundleAddress.toString();
      const bundleMintStr = typeof bundleMint === 'string' ? bundleMint : bundleMint.toString();

      console.log('converted bundleAddressStr:', bundleAddressStr);
      console.log('converted bundleMintStr:', bundleMintStr);

      addLog(`🗑️ Deleting bundle: ${bundleAddressStr.slice(0, 12)}...`, 'info');

      try {
        // Get Associated Token Account for the bundle token
        const bundleTokenAccount = getAssociatedTokenAddressSync(
          new PublicKey(bundleMintStr),
          new PublicKey(publicKey.toBase58())
        );

        // Build the instruction data for deletePositionBundle
        // Discriminator for deletePositionBundle
        const instructionData = Buffer.from([0xf5, 0x67, 0xd9, 0x1f, 0x2b, 0x9f, 0xeb, 0xaf]);

        const accounts = [
          { pubkey: new PublicKey(bundleAddressStr), isSigner: false, isWritable: true },
          { pubkey: new PublicKey(bundleMintStr), isSigner: false, isWritable: true },
          { pubkey: bundleTokenAccount, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: false },
          { pubkey: publicKey, isSigner: false, isWritable: true }, // receiver
          { pubkey: new PublicKey('TokenkegQfeZyiNwAJsyFbPVwwQQfuTft3yaYr5fn5Dt'), isSigner: false, isWritable: false },
        ];

        const instruction = new TransactionInstruction({
          programId: new PublicKey('whirLbMiicVdio4KfUadKvARms81e3G7prfqSa7PjI'),
          keys: accounts,
          data: instructionData,
        });

        const transaction = new Transaction().add(instruction);
        transaction.feePayer = publicKey;

        const latestBlockhash = await connection.getLatestBlockhash();
        transaction.recentBlockhash = latestBlockhash.blockhash;

        if (!signTransaction) {
          throw new Error('Wallet does not support signing');
        }

        addLog('📝 Signing transaction...', 'info');
        const signed = await signTransaction(transaction);

        addLog('📤 Sending transaction...', 'info');
        const txId = await connection.sendRawTransaction(signed.serialize());

        addLog(`⏳ Confirming deletion... (${txId.slice(0, 8)}...)`, 'info');
        await connection.confirmTransaction({
          signature: txId,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        }, 'confirmed');

        addLog(`✓ Bundle deleted successfully!`, 'success');

        // Refresh bundles list
        await fetchOwnerBundles();
      } catch (addressErr: any) {
        console.error('Address conversion error:', addressErr);
        throw new Error(`Failed to process addresses: ${addressErr.message}`);
      }
    } catch (err: any) {
      console.error('Delete bundle error:', err);
      addLog(`Failed to delete bundle: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEmptyPositions = async () => {
    if (!loadedBundle) {
      addLog('Load a bundle first', 'error');
      return;
    }

    const poolAddr = loadedPoolData?.address || selectedWhirlpool?.address;
    if (!poolAddr) {
      addLog('No pool selected. Load a bundle with positions or select a pool.', 'error');
      return;
    }

    if (!publicKey) {
      addLog('Connect wallet first', 'error');
      return;
    }

    if (!signAllTransactions) {
      addLog('Wallet does not support signAllTransactions', 'error');
      return;
    }

    const numPos = parseInt(numPositions) || 10;
    const rangePct = parseFloat(rangePercent) / 100 || 0.01;
    const startIdx = bundlePositionCount || 0;

    addLog(`Creating ${numPos} EMPTY positions with ${rangePercent}% range each (starting at index ${startIdx})...`, 'info');
    setIsLoading(true);

    try {
      const walletPubkey = address(publicKey.toBase58());
      const bundleAta = loadedBundle?.data?.ataAddress || loadedBundle?.ataAddress;
      
      if (!bundleAta) {
        addLog('Bundle ATA not found in loaded bundle data. Re-load the bundle.', 'error');
        setIsLoading(false);
        return;
      }

      // Import the function for creating empty positions
      const { createLargeDistributedPositionBatch } = await import('@/lib/createBundledPositions');

      addLog('Creating position structure...', 'info');
      const result = await createLargeDistributedPositionBatch(
        nftAddressInput,
        poolAddr,
        rpc,
        walletPubkey,
        numPos,
        rangePct,
        startIdx,
        bundleAta
      );

      if (!result || !result.batches || result.batches.length === 0) {
        addLog('❌ No position batches were created. Check tick range validity.', 'error');
        return;
      }

      addLog(`✓ Created ${result.totalBatches} transaction batches for ${numPos} empty positions`, 'success');
      addLog('Building transactions for signing...', 'info');

      const { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } = await import('@solana/web3.js');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const web3Transactions = result.batches.map((batch: any) => {
        const convertedIxs = batch.instructions.map((ix: any) => {
          const programId = ix.programAddress || ix.programId;
          const accounts = ix.accounts || ix.keys || [];
          const data = ix.data || Buffer.alloc(0);

          return new TransactionInstruction({
            programId: new PublicKey(programId.toString()),
            keys: accounts.map((acc: any) => ({
              pubkey: new PublicKey((acc.address || acc.pubkey).toString()),
              isSigner: acc.role === 3 || acc.role === 2 || acc.isSigner === true,
              isWritable: acc.role === 1 || acc.role === 3 || acc.isWritable === true,
            })),
            data: Buffer.from(data),
          });
        });

        const messageV0 = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: convertedIxs,
        }).compileToV0Message();

        return new VersionedTransaction(messageV0);
      });
      
      addLog(`Requesting wallet signature for ${web3Transactions.length} transactions...`, 'info');
      const signedTxs = await signAllTransactions(web3Transactions);
      addLog(`✓ All ${signedTxs.length} transactions signed! Sending sequentially...`, 'success');

      let successCount = 0;
      for (let i = 0; i < signedTxs.length; i++) {
        const signedTx = signedTxs[i];
        try {
          const sig = await connection.sendRawTransaction(signedTx.serialize());
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
          
          addLog(`✓ Transaction ${i + 1}/${signedTxs.length} confirmed: ${sig.slice(0, 20)}...`, 'success');
          successCount++;
          await new Promise(r => setTimeout(r, 1000));
        } catch (sendErr: any) {
          addLog(`❌ Transaction ${i + 1} failed: ${sendErr.message}`, 'error');
        }
      }

      addLog(`✓ Successfully created ${successCount}/${result.totalBatches} position batches!`, 'success');
    } catch (err: any) {
      addLog(`❌ Failed to create empty positions: ${err.message}`, 'error');
      console.error('Error details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLiquidityAndPositions = async () => {
    if (!loadedBundle) {
      addLog('Load a bundle first', 'error');
      return;
    }

    const poolAddr = loadedPoolData?.address || selectedWhirlpool?.address;
    if (!poolAddr) {
      addLog('No pool selected. Load a bundle with positions or select a pool.', 'error');
      return;
    }

    if (!publicKey) {
      addLog('Connect wallet first', 'error');
      return;
    }

    if (!signAllTransactions) {
      addLog('Wallet does not support signAllTransactions', 'error');
      return;
    }

    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      addLog('Enter a valid fund amount in SOL', 'error');
      return;
    }

    const numPos = parseInt(numPositions) || 10;
    const rangePct = parseFloat(rangePercent) / 100 || 0.01;
    const startIdx = bundlePositionCount || 0;

    addLog(`Creating ${numPos} positions with liquidity and ${rangePercent}% range each (starting at index ${startIdx})...`, 'info');
    setIsLoading(true);

    try {
      const walletPubkey = address(publicKey.toBase58());
      const totalSolAmount = BigInt(Math.floor(parseFloat(fundAmount) * 1e9));
      const bundleAta = loadedBundle?.data?.ataAddress || loadedBundle?.ataAddress;
      
      if (!bundleAta) {
        addLog('Bundle ATA not found in loaded bundle data. Re-load the bundle.', 'error');
        setIsLoading(false);
        return;
      }

      // Import functions for creating positions with liquidity
      const { createPositionsWithLiquidity } = await import('@/lib/createBundledPositions');

      addLog('Creating positions with liquidity...', 'info');
      const result = await createPositionsWithLiquidity(
        nftAddressInput,
        poolAddr,
        rpc,
        {
          publicKey: walletPubkey,
          address: walletPubkey,
          signAllTransactions,
          signAndSendTransactions: async (transactions: any) => {
            const signed = await signAllTransactions(transactions.map((tx: any) => tx.messageBytes ? new VersionedTransaction(tx.messageBytes) : tx) as any[]);
            return signed.map((tx: any, idx: number) => ({
              messageBytes: tx.message.serialize(),
              signatures: new Map()
            })) as any[];
          }
        } as any,
        totalSolAmount,
        numPos,
        rangePct,
        startIdx,
        bundleAta
      );

      if (!result.positionBatches || result.positionBatches.length === 0) {
        addLog('❌ No position batches were created. Check tick range validity.', 'error');
        return;
      }

      addLog(`✓ Prepared ${result.totalBatches} transaction batches for ${result.totalPositions} positions`, 'success');
      addLog(`Building transactions for signing...`, 'info');

      const { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } = await import('@solana/web3.js');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      // Only add liquidity to in-range positions
      const inRangePositionBatches = result.positionBatches.filter((batch: any) => {
        // Filter logic: only include positions that would be in-range
        // You can add specific logic here if needed
        return true; // Include all for now, can be refined based on position range
      });

      const web3Transactions = inRangePositionBatches.map((batch: any) => {
        const convertedIxs = batch.instructions.map((ix: any) => {
          const programId = ix.programAddress || ix.programId;
          const accounts = ix.accounts || ix.keys || [];
          const data = ix.data || Buffer.alloc(0);

          return new TransactionInstruction({
            programId: new PublicKey(programId.toString()),
            keys: accounts.map((acc: any) => ({
              pubkey: new PublicKey((acc.address || acc.pubkey).toString()),
              isSigner: acc.role === 3 || acc.role === 2 || acc.isSigner === true,
              isWritable: acc.role === 1 || acc.role === 3 || acc.isWritable === true,
            })),
            data: Buffer.from(data),
          });
        });

        const messageV0 = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: convertedIxs,
        }).compileToV0Message();

        return new VersionedTransaction(messageV0);
      });

      addLog(`Requesting wallet signature for ${web3Transactions.length} transactions...`, 'info');
      const signedTxs = await signAllTransactions(web3Transactions);
      addLog(`✓ All ${signedTxs.length} transactions signed! Sending sequentially...`, 'success');

      let successCount = 0;
      for (let i = 0; i < signedTxs.length; i++) {
        const signedTx = signedTxs[i];
        try {
          const sig = await connection.sendRawTransaction(signedTx.serialize());
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
          
          addLog(`✓ Transaction ${i + 1}/${signedTxs.length} confirmed: ${sig.slice(0, 20)}...`, 'success');
          successCount++;
          await new Promise(r => setTimeout(r, 1000));
        } catch (sendErr: any) {
          addLog(`❌ Transaction ${i + 1} failed: ${sendErr.message}`, 'error');
        }
      }

      addLog(`✓ Successfully added liquidity to ${successCount}/${result.totalBatches} position batches!`, 'success');
    } catch (err: any) {
      addLog(`❌ Failed to create positions with liquidity: ${err.message}`, 'error');
      console.error('Error details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPositions = async () => {
    if (!loadedBundle) {
      addLog('Load a bundle first', 'error');
      return;
    }

    const poolAddr = loadedPoolData?.address || selectedWhirlpool?.address;
    if (!poolAddr) {
      addLog('No pool selected. Load a bundle with positions or select a pool.', 'error');
      return;
    }

    if (!publicKey) {
      addLog('Connect wallet first', 'error');
      return;
    }

    if (!signAllTransactions) {
      addLog('Wallet does not support signAllTransactions', 'error');
      return;
    }

    const numPos = parseInt(numPositions) || 10;
    const rangePct = parseFloat(rangePercent) / 100 || 0.01;
    const startIdx = bundlePositionCount || 0;

    addLog(`Creating ${numPos} positions with ${rangePercent}% range each (starting at index ${startIdx})...`, 'info');
    setIsLoading(true);

    try {
      const walletPubkey = address(publicKey.toBase58());

      // ============ DEBUG: VALIDATE ALL INPUTS ============
      addLog('🔍 Starting validation checks...', 'info');

      // Calculate total SOL amount first
      const totalSolAmount = BigInt(Math.floor(parseFloat(fundAmount || '0') * 1e9));

      const validation = validatePositionCreationInputs({
        bundleMintAddress: nftAddressInput,
        poolAddress: poolAddr,
        totalPositions: numPos,
        rangePercent: rangePct,
        totalSolAmount: totalSolAmount,
        walletPublicKey: walletPubkey
      });

      if (!validation.valid) {
        const errorMsg = `Validation errors:\n${validation.errors.join('\n')}`;
        addLog(errorMsg, 'error');
        console.error('❌ VALIDATION FAILED:', validation.errors);
        setIsLoading(false);
        return;
      }

      addLog('✓ All input validations passed', 'success');

      // ============ DEBUG: LOG WALLET STATUS ============
      logWalletStatus({
        walletPublicKey: walletPubkey,
        isConnected: !!publicKey,
        supportsSignAllTransactions: !!signAllTransactions,
        walletName: 'Connected'
      });
      addLog(`✓ Wallet connected: ${walletPubkey.toString().slice(0, 12)}...`, 'success');

      // ============ DEBUG: LOG POSITION PARAMETERS ============
      logPositionParams({
        totalPositions: numPos,
        totalSolAmount: totalSolAmount,
        rangePercent: rangePct,
        tokenAPerPosition: 0n,
        tokenBPerPosition: 0n,
        startIndex: startIdx,
        slippageToleranceBps: 100
      });

      const bundleAta = rawBundleData?.ataAddress;
      if (!bundleAta) {
        addLog('Bundle ATA not found in loaded bundle data. Re-load the bundle.', 'error');
        setIsLoading(false);
        return;
      }

      // ============ DEBUG: VALIDATE ALL ADDRESSES ============
      addLog('📋 Validating all addresses...', 'info');

      const bundleAtaValidation = validateWalletAddress(bundleAta, 'Bundle ATA');
      const bundleMintValidation = validateWalletAddress(nftAddressInput, 'Bundle Mint');
      const poolValidation = validateWalletAddress(poolAddr, 'Pool Address');

      if (!bundleAtaValidation.valid || !bundleMintValidation.valid || !poolValidation.valid) {
        addLog(`Address validation failed:\n${bundleAtaValidation.message}\n${bundleMintValidation.message}\n${poolValidation.message}`, 'error');
        setIsLoading(false);
        return;
      }

      addLog('✓ All critical addresses validated', 'success');
      addLog(`Bundle Mint: ${nftAddressInput.slice(0, 12)}...`, 'info');
      addLog(`Pool Address: ${poolAddr.slice(0, 12)}...`, 'info');
      addLog(`Bundle ATA: ${bundleAta.slice(0, 12)}...`, 'info');
      addLog(`Wallet: ${walletPubkey.toString().slice(0, 12)}...`, 'info');

      const result = await createPositionsWithLiquidity(
        nftAddressInput,
        poolAddr,
        rpc,
        {
          publicKey: walletPubkey,
          address: walletPubkey,
          signAllTransactions,
          signAndSendTransactions: async (transactions) => {
            const signed = await signAllTransactions(transactions.map(tx => tx.messageBytes ? new VersionedTransaction(tx.messageBytes) : tx) as any[]);
            return signed.map((tx, idx) => ({
              messageBytes: tx.message.serialize(),
              signatures: new Map()
            })) as any[];
          }
        },
        totalSolAmount,
        numPos,
        rangePct,
        startIdx,
        bundleAta
      );

      if (!result.positionBatches || result.positionBatches.length === 0) {
        addLog('❌ No position batches were created. Check tick range validity.', 'error');
        addLog('⚠️  This can happen if:  - rangePercent is too small (try increasing it), - tickSpacing is incompatible with your price range, - All positions failed validation', 'info');
        console.error('Position creation failed. Result:', result);
        return;
      }

      addLog(`Prepared ${result.totalBatches} transaction batches for ${result.totalPositions} positions`, 'success');
      addLog(`Requesting approval for ${result.totalBatches} transactions...`, 'info');

      const { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } = await import('@solana/web3.js');
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const web3Transactions = result.positionBatches.map((batch) => {
        const convertedIxs = batch.instructions.map((ix: any) => {
          const programId = ix.programAddress || ix.programId;
          const accounts = ix.accounts || ix.keys || [];
          const data = ix.data || Buffer.alloc(0);

          return new TransactionInstruction({
            programId: new PublicKey(programId.toString()),
            keys: accounts.map((acc: any) => ({
              pubkey: new PublicKey((acc.address || acc.pubkey).toString()),
              isSigner: acc.role === 3 || acc.role === 2 || acc.isSigner === true,
              isWritable: acc.role === 1 || acc.role === 3 || acc.isWritable === true,
            })),
            data: Buffer.from(data),
          });
        });

        const messageV0 = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: convertedIxs,
        }).compileToV0Message();

        return new VersionedTransaction(messageV0);
      });

      addLog(`Requesting wallet signature for ${web3Transactions.length} transactions...`, 'info');
      const signedTxs = await signAllTransactions(web3Transactions);
      addLog(`All ${signedTxs.length} transactions signed! Sending sequentially...`, 'success');

      for (let i = 0; i < signedTxs.length; i++) {
        const signedTx = signedTxs[i];
        try {
          const sig = await connection.sendRawTransaction(signedTx.serialize());
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });

          addLog(`Transaction ${i + 1}/${signedTxs.length} confirmed: ${sig}`, 'success');

          await new Promise(r => setTimeout(r, 1000));
        } catch (sendErr: any) {
          addLog(`Transaction ${i + 1} failed: ${sendErr.message}`, 'error');
          throw sendErr;
        }
      }

      addLog(`All ${result.totalPositions} positions created successfully!`, 'success');
    } catch (err: any) {
      addLog(`Failed to create positions: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeDashboard === 'view-bundle' && publicKey) {
      fetchOwnerBundles();
    }
  }, [activeDashboard, publicKey]);

  const countOccupiedPositions = (bitmap: Uint8Array | number[]): number => {
    let count = 0;
    for (let i = 0; i < bitmap.length; i++) {
      let byte = bitmap[i];
      while (byte) {
        count += byte & 1;
        byte >>= 1;
      }
    }
    return count;
  };

  const getOccupiedIndices = (bitmap: Uint8Array | number[]): number[] => {
    const indices: number[] = [];
    for (let byteIndex = 0; byteIndex < bitmap.length; byteIndex++) {
      const byte = bitmap[byteIndex];
      for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
        if ((byte >> bitIndex) & 1) {
          indices.push(byteIndex * 8 + bitIndex);
        }
      }
    }
    return indices;
  };

  const fetchOwnerBundles = async () => {
    if (!publicKey) return;
    setBundlesLoading(true);
    try {
      const ownerAddress = address(publicKey.toBase58());
      const positions = await fetchPositionsForOwner(rpc, ownerAddress);
      const bundles = positions.filter((p: any) => p.isPositionBundle);

      if (bundles.length === 0) {
        addLog('No position bundles found in wallet', 'info');
        setPositionBundles([]);
        return;
      }

      addLog(`Found ${bundles.length} bundle(s) in wallet. Processing...`, 'info');

      const enrichedBundles = await Promise.all(bundles.map(async (bundle: any) => {
        const bitmap = bundle.data?.positionBitmap || new Uint8Array(32);
        const occupiedCount = countOccupiedPositions(bitmap);
        const occupiedIndices = getOccupiedIndices(bitmap);
        const mintAddress = bundle.data?.positionBundleMint?.toString();
        const bundleAddress = bundle.address?.toString();

        let fileData: any = null;

        if (bundleAddress) {
          try {
            // Try to load from /style folder first
            addLog(`📦 Processing bundle: ${bundleAddress.slice(0, 12)}...`, 'info');
            const res = await fetch(`/style/${bundleAddress}.json`);

            if (res.ok) {
              fileData = await res.json();
              addLog(`✓ Loaded cached data for ${bundleAddress.slice(0, 12)}...`, 'success');
            } else {
              // File doesn't exist, create it using fetchBundles logic
              addLog(`📝 Creating cache for ${bundleAddress.slice(0, 12)}...`, 'info');

              try {
                // Import fetchBundles to get bundle details
                const { getPositionBundle } = await import('@/lib/fetchBundles');
                const bundlePoolData = await getPositionBundle(rpc, address(bundleAddress));

                // Fetch pool data to get token symbols
                let poolSymbol = null;
                if (bundlePoolData?.poolAddress) {
                  try {
                    const poolData = await getPoolData(bundlePoolData.poolAddress, rpcUrl, network);
                    poolSymbol = `${poolData.tokenA.symbol}/${poolData.tokenB.symbol}`;
                  } catch (poolErr) {
                    addLog(`Could not fetch pool data for symbols: ${poolErr}`, 'warning');
                  }
                }

                // Create the bundle cache data structure
                const cacheData = {
                  bundleAddress,
                  bundleMint: mintAddress,
                  positionBitmap: Array.from(bitmap),
                  occupiedCount,
                  occupiedIndices,
                  poolAddress: bundlePoolData?.poolAddress || null,
                  poolSymbol: poolSymbol,
                  name: bundle.data?.name || `Bundle ${bundleAddress.slice(0, 8)}`,
                  symbol: bundle.data?.symbol || 'BUNDLE',
                  uri: bundle.data?.uri || '',
                  createdAt: new Date().toISOString(),
                  positions: occupiedIndices.map(idx => ({
                    index: idx,
                    address: `${bundleAddress}:${idx}`
                  }))
                };

                // Save to cache via API
                try {
                  await fetch('/api/bundle-cache', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      positionBundleMint: mintAddress,
                      bundleAddress,
                      poolAddress: bundlePoolData?.poolAddress || null,
                      poolSymbol: bundlePoolData?.poolSymbol || null,
                      name: bundle.data?.name || `Bundle ${bundleAddress.slice(0, 8)}`,
                      symbol: bundle.data?.symbol || 'BUNDLE',
                      uri: bundle.data?.uri || '',
                      occupiedCount,
                      occupiedIndices,
                      positions: occupiedIndices.map(idx => ({
                        index: idx,
                        address: `${bundleAddress}:${idx}`
                      }))
                    })
                  });

                  fileData = cacheData;
                  addLog(`✓ Cached data for ${bundleAddress.slice(0, 12)}...`, 'success');
                } catch (cacheErr: any) {
                  addLog(`⚠ Could not save cache: ${cacheErr.message}`, 'error');
                  fileData = cacheData;
                }
              } catch (err: any) {
                addLog(`⚠ Could not create bundle cache: ${err.message}`, 'error');
              }
            }
          } catch (err: any) {
            addLog(`⚠ Error processing bundle ${bundleAddress?.slice(0, 12)}: ${err.message}`, 'error');
          }
        }

        return {
          ...bundle,
          occupiedCount,
          occupiedIndices,
          name: bundle.data?.name || 'Unnamed Bundle',
          symbol: bundle.data?.symbol || 'N/A',
          uri: bundle.data?.uri || '',
          fileData,
        };
      }));

      setPositionBundles(enrichedBundles);
      addLog(`✓ Processed ${enrichedBundles.length} bundle(s)`, 'success');
    } catch (err: any) {
      addLog(`Failed to fetch bundles: ${err.message}`, 'error');
      setPositionBundles([]);
    } finally {
      setBundlesLoading(false);
    }
  };

  const fetchPositionDetails = async (bundleIdx: number, bundle: any, posIndex: number) => {
    const key = `${bundleIdx}-${posIndex}`;
    if (positionDetails.has(key) || loadingPositions.has(key)) return;

    setLoadingPositions(prev => new Set(prev).add(key));

    try {
      const { fetchPosition, getBundledPositionAddress } = await import('@orca-so/whirlpools-client');
      const { tickIndexToPrice } = await import('@orca-so/whirlpools-core');

      const bundleMint = bundle.data?.positionBundleMint;
      if (!bundleMint) throw new Error('Bundle mint not found');

      const [bundledPositionAddress] = await getBundledPositionAddress(bundleMint, posIndex);
      const position = await fetchPosition(rpc, bundledPositionAddress);

      if (!position?.data) throw new Error('Position data not found');

      const data = position.data;
      const decimalsA = 9;
      const decimalsB = 6;

      const lowerPrice = tickIndexToPrice(data.tickLowerIndex, decimalsA, decimalsB);
      const upperPrice = tickIndexToPrice(data.tickUpperIndex, decimalsA, decimalsB);

      const details = {
        positionAddress: bundledPositionAddress.toString(),
        tickLowerIndex: data.tickLowerIndex,
        tickUpperIndex: data.tickUpperIndex,
        lowerPrice: Number(lowerPrice),
        upperPrice: Number(upperPrice),
        liquidity: data.liquidity?.toString() || '0',
        feeOwedA: data.feeOwedA?.toString() || '0',
        feeOwedB: data.feeOwedB?.toString() || '0',
        feeGrowthCheckpointA: data.feeGrowthCheckpointA?.toString() || '0',
        feeGrowthCheckpointB: data.feeGrowthCheckpointB?.toString() || '0',
        rewardInfos: data.rewardInfos || [],
      };

      setPositionDetails(prev => new Map(prev).set(key, details));
    } catch (err: any) {
      console.error(`Failed to fetch position ${posIndex}:`, err);
      setPositionDetails(prev => new Map(prev).set(key, { error: err.message }));
    } finally {
      setLoadingPositions(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const renderPoolInfoPanel = () => {
    if (!selectedWhirlpool) return null;
    return (
      <div className="mb-4 p-4 bg-zinc-900 border border-zinc-800 rounded-sm">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Pool Details</h3>
          <button onClick={() => setSelectedWhirlpool(null)} className="text-zinc-500 hover:text-zinc-300">CLOSE</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <span className="text-zinc-500 text-[10px]">ADDRESS</span>
            <span
              className="text-cyan-500 cursor-pointer truncate hover:underline"
              onClick={() => copyToClipboard(selectedWhirlpool.address)}
            >
              {selectedWhirlpool.address}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-500 text-[10px]">TICK SPACING</span>
            <span className="text-zinc-200 font-mono">{selectedWhirlpool.tickSpacing || selectedWhirlpool.data?.tickSpacing}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-500 text-[10px]">CURRENT PRICE</span>
            <span className="text-zinc-200 font-mono">{poolMetadata?.price?.toFixed(6) || 'Loading...'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-zinc-500 text-[10px]">CURRENT TICK</span>
            <span className="text-zinc-200 font-mono">{selectedWhirlpool.data?.tickCurrentIndex}</span>
          </div>
        </div>
        {(tokenAInfo || tokenBInfo) && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <h4 className="text-[11px] font-bold text-zinc-500 uppercase mb-2">Token Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1 bg-black/30 p-2 border border-zinc-800/50">
                <span className="text-zinc-500 text-[10px]">TOKEN A</span>
                <span
                  className="text-zinc-300 truncate cursor-pointer hover:text-cyan-400 text-[10px] font-mono"
                  onClick={() => copyToClipboard(tokenAInfo?.mint)}
                >
                  {tokenAInfo?.mint || 'Loading...'}
                </span>
                <span className="text-cyan-500 text-[11px] font-bold">Decimals: {tokenAInfo?.decimals ?? 'Loading...'}</span>
              </div>
              <div className="flex flex-col gap-1 bg-black/30 p-2 border border-zinc-800/50">
                <span className="text-zinc-500 text-[10px]">TOKEN B</span>
                <span
                  className="text-zinc-300 truncate cursor-pointer hover:text-cyan-400 text-[10px] font-mono"
                  onClick={() => copyToClipboard(tokenBInfo?.mint)}
                >
                  {tokenBInfo?.mint || 'Loading...'}
                </span>
                <span className="text-cyan-500 text-[11px] font-bold">Decimals: {tokenBInfo?.decimals ?? 'Loading...'}</span>
              </div>
            </div>
          </div>
        )}
        {poolMetadata && (
          <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span className="text-zinc-500 text-[10px]">LIQUIDITY</span>
              <span className="text-zinc-400 font-mono">{poolMetadata.data?.liquidity.toString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-zinc-500 text-[10px]">FEE RATE</span>
              <span className="text-zinc-400 font-mono">{poolMetadata.data?.feeRate / 10000}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-zinc-500 text-[10px]">TOKEN A MINT</span>
              <span
                className="text-zinc-400 truncate cursor-pointer hover:text-zinc-200"
                onClick={() => copyToClipboard(poolMetadata.data?.tokenMintA)}
              >
                {poolMetadata.data?.tokenMintA}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-zinc-500 text-[10px]">TOKEN B MINT</span>
              <span
                className="text-zinc-400 truncate cursor-pointer hover:text-zinc-200"
                onClick={() => copyToClipboard(poolMetadata.data?.tokenMintB)}
              >
                {poolMetadata.data?.tokenMintB}
              </span>
            </div>
          </div>
        )}
        {lastTransactions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[11.5px] font-bold text-zinc-500 uppercase">Last 5 Transactions</h4>
              <span className="text-[9.5px] text-zinc-600">POOLED DATA</span>
            </div>
            <div className="flex flex-col gap-1">
              {lastTransactions.map((tx, idx) => (
                <div key={idx} className="flex justify-between items-center bg-black/40 p-1.5 border border-zinc-800/50 hover:border-zinc-700 group transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-1 h-1 rounded-full ${tx.err ? 'bg-red-500' : 'bg-green-500'}`}></span>
                    <span
                      className="text-zinc-400 font-mono text-[10.5px] truncate cursor-pointer group-hover:text-cyan-400"
                      onClick={() => copyToClipboard(tx.signature)}
                    >
                      {tx.signature}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {tx.price && (
                      <span className="text-[10.5px] text-cyan-500 font-mono">
                        ${Number(tx.price).toFixed(6)}
                      </span>
                    )}
                    <span className="text-[10.5px] text-zinc-600 font-mono uppercase">
                      {tx.err ? 'FAILED' : 'SUCCESS'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDashboard = () => {

    switch (activeDashboard) {
      case 'config':
        return (
          <div className="flex flex-col gap-4 p-4 border border-zinc-800 bg-zinc-950 text-xs font-mono">
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Wallet / RPC Config</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-zinc-500">NETWORK SELECTION</label>
                <select
                  className="bg-black border border-zinc-800 p-1 text-zinc-300 outline-none"
                  value={network}
                  onChange={(e) => handleNetworkChange(e.target.value as any)}
                >

                  <option value="mainnet">MAINNET</option>
                  <option value="devnet">DEVNET</option>
                  <option value="custom">CUSTOM</option>
                </select>
                <label className="text-zinc-500 mt-2">RPC URL</label>
                <input
                  className="bg-black border border-zinc-800 p-1 text-zinc-300"
                  value={rpcUrl}
                  onChange={(e) => setRpcUrl(e.target.value)}
                />
                <div className="mt-4">
                  <WalletMultiButton className="!bg-zinc-100 !text-black !rounded-none !font-bold !text-xs !h-10 !w-full" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-zinc-500">EDIT .ENV</label>
                <textarea
                  className="bg-black border border-zinc-800 p-2 text-zinc-400 h-40 resize-none outline-none font-mono"
                  value={env}
                  onChange={(e) => setEnv(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={loadEnv} className="flex-1 bg-zinc-800 text-zinc-100 py-1 font-bold hover:bg-zinc-700" disabled={isLoading}>LOAD .ENV</button>
                  <button onClick={saveEnv} className="flex-1 bg-zinc-800 text-zinc-100 py-1 font-bold hover:bg-zinc-700" disabled={isLoading}>{isLoading ? 'SAVING...' : 'SAVE .ENV'}</button>
                </div>
                <button onClick={testConfig} className="mt-2 bg-cyan-900/30 text-cyan-500 border border-cyan-500/30 py-2 font-bold hover:bg-cyan-900/50" disabled={isLoading}>TEST WHIRLPOOLS CONFIG</button>
              </div>
            </div>
            {publicKey && (
              <div className="mt-4 p-2 bg-zinc-900 border border-zinc-800">
                <div className="flex justify-between">
                  <span className="text-zinc-500">ADDRESS:</span>
                  <span className="text-zinc-300">{publicKey.toBase58()}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-zinc-500">BALANCE:</span>
                  <span className="text-zinc-300">{(Number(balance) / 1e9).toFixed(4)} SOL</span>
                </div>
              </div>
            )}
          </div>
        );
      case 'search':
        return (
          <div className="p-4 border border-zinc-800 bg-zinc-950 text-xs font-mono">
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Whirlpools Search</h2>

            <div className="mt-4 p-2 bg-zinc-900/50 border border-zinc-800 mb-4">
              <label className="text-zinc-500 text-[10px] uppercase mb-1 block">Search by Pool Address</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-black border border-zinc-800 p-1 text-zinc-300"
                  placeholder="Paste Whirlpool Address..."
                  value={poolAddressInput}
                  onChange={(e) => setPoolAddressInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchByAddress()}
                />
                <button className="bg-cyan-900/30 text-cyan-500 border border-cyan-500/30 px-4 hover:bg-cyan-900/50 transition-colors" onClick={searchByAddress} disabled={isLoading}>SEARCH ADDRESS</button>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <label className="text-zinc-500 text-[10px] uppercase mb-1 block">Search by Token Pair</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-black border border-zinc-800 p-1 text-zinc-300"
                  placeholder="Token A Symbol or Address"
                  value={tokenASymbol}
                  onChange={(e) => setTokenASymbol(e.target.value)}
                />
                <input
                  className="flex-1 bg-black border border-zinc-800 p-1 text-zinc-300"
                  placeholder="Token B Symbol or Address"
                  value={tokenBSymbol}
                  onChange={(e) => setTokenBSymbol(e.target.value)}
                />
                <button className="bg-cyan-900/30 text-cyan-500 border border-cyan-500/30 px-4 hover:bg-cyan-900/50 transition-colors" onClick={searchPools} disabled={isLoading}>{isLoading ? '...' : 'SEARCH PAIR'}</button>
              </div>
              <button className="w-full bg-zinc-900 border border-zinc-800 py-1 text-zinc-400 hover:text-zinc-200" onClick={fetchLatestPools} disabled={isLoading}>GET LATEST POOLS</button>
            </div>

            {renderPoolInfoPanel()}

            <div className="mt-4 border border-zinc-800">
              <div className="grid grid-cols-[1fr_120px_80px_80px] gap-8 bg-zinc-900 p-1 text-zinc-500 font-bold border-b border-zinc-800">
                <span>ADDRESS</span>
                <span className="text-center">TICK / SPACING</span>
                <span className="text-center">REWARDS</span>
                <span className="text-center">ACTION</span>
              </div>
              {whirlpools.length === 0 && <div className="p-4 text-center text-zinc-600">No pools found</div>}
              {whirlpools.map((p, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[1fr_120px_80px_80px] gap-8 p-1 hover:bg-zinc-900 cursor-pointer text-zinc-300 ${selectedWhirlpool?.address === p.address ? 'bg-zinc-800 border-l-2 border-cyan-500' : ''}`}
                  onClick={() => handleSelectPool(p)}
                >
                  <span className="font-mono">{p.address}</span>
                  <span className="text-center">{p.data?.tickCurrentIndex ?? p.data.tickCurrentIndex} / {p.data?.tickSpacing ?? p.tickSpacing}</span>
                  <span className="text-center">{p.data.rewardInfos.filter((r: any) => r.initialized).length}</span>
                  <button className="text-center text-cyan-500" onClick={(e) => { e.stopPropagation(); handleSelectPool(p); }}>SELECT</button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'latest':
        return (
          <div className="p-4 border border-zinc-800 bg-zinc-950 text-xs font-mono">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Latest Pools</h2>
              <button className="bg-zinc-800 px-2 py-1 text-zinc-100 hover:bg-zinc-700" onClick={fetchLatestPools} disabled={isLoading}>REFRESH</button>
            </div>

            {renderPoolInfoPanel()}

            <div className="border border-zinc-800">
              <div className="grid grid-cols-5 bg-zinc-900 p-1 text-zinc-500 font-bold border-b border-zinc-800">
                <span>ADDRESS</span>
                <span>PRICE</span>
                <span>TICK (CUR/SPACE)</span>
                <span>REWARDS</span>
                <span>ACTION</span>
              </div>
              {isLoading && latestWhirlpools.length === 0 && <div className="p-4 text-center text-zinc-600 animate-pulse">Fetching network data...</div>}
              {latestWhirlpools.length === 0 && !isLoading && <div className="p-4 text-center text-zinc-500">No pools loaded. Click REFRESH to fetch.</div>}
              {latestWhirlpools.map((p, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-5 p-1 hover:bg-zinc-900 cursor-pointer text-zinc-300 ${selectedWhirlpool?.address === p.address ? 'bg-zinc-800 border-l-2 border-cyan-500' : ''}`}
                  onClick={() => handleSelectPool(p)}
                >
                  <span className="truncate">{p.address}</span>
                  <span>{p.price?.toFixed?.(6) ?? '0'}</span>
                  <span>{p.data?.tickCurrentIndex ?? 0} / {p.data?.tickSpacing ?? 0}</span>
                  <span>{p.data?.rewardInfos?.filter((r: any) => r.initialized).length ?? 0}</span>
                  <button className="text-cyan-500 text-left" onClick={(e) => { e.stopPropagation(); handleSelectPool(p); }}>SELECT</button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'docs':
        return (
          <div className="p-4 border border-zinc-800 bg-zinc-950 text-xs font-mono flex flex-col gap-4">
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Developer Documentation</h2>
            <div className="p-4 bg-zinc-900 border border-zinc-800 flex flex-col gap-4 text-zinc-400 leading-relaxed overflow-y-auto max-h-[60vh]">
              <section>
                <h3 className="text-zinc-100 font-bold mb-2">WHIRLPOOL SDK OVERVIEW</h3>
                <p>Whirlpools is an open-sourced concentrated liquidity automated market maker (CLAMM) on Solana. The SDK provides modular interaction with the Whirlpool Program.</p>
              </section>
              <section>
                <h3 className="text-zinc-100 font-bold mb-2">SDK COMPONENTS</h3>
                <ul className="list-disc list-inside flex flex-col gap-1">
                  <li><span className="text-cyan-500">High-Level SDK:</span> Top recommendation for integration. Abstracts tick array management and simplifies swaps/liquidity.</li>
                  <li><span className="text-cyan-500">Core SDK:</span> Essential utilities for math operations and quotes. Written in Rust, compiled to WASM.</li>
                  <li><span className="text-cyan-500">Low-Level SDK:</span> Autogenerated from IDL. Direct program interactions with accounts and instructions.</li>
                </ul>
              </section>
              <section>
                <h3 className="text-zinc-100 font-bold mb-2">KEY ADDRESSES</h3>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between bg-black p-1 border border-zinc-800">
                    <span>PROGRAM ID</span>
                    <span className="text-zinc-100">whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc</span>
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-zinc-100 font-bold mb-2">USAGE EXAMPLES</h3>
                <pre className="bg-black p-2 text-[9px] text-zinc-500 overflow-x-auto">
                  {`import { fetchWhirlpoolsByTokenPair } from '@orca-so/whirlpools';

const pools = await fetchWhirlpoolsByTokenPair(
  rpc,
  tokenMintA,
  tokenMintB
);`}
                </pre>
              </section>
            </div>
          </div>
        );

      case 'files':
        return (
          <div className="border border-zinc-800 bg-zinc-950 flex flex-col h-full">
            <FileBrowserContainer />
          </div>
        );

      case 'create-bundle':
        return (
          <div className="p-4 border border-zinc-800 bg-zinc-950 text-xs font-mono">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Create Position Bundle</h2>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-[10px]">LOAD BUNDLE:</span>
                <select
                  className="bg-black border border-zinc-800 px-2 py-1 text-zinc-300 text-[10px] min-w-[200px]"
                  value={loadedBundle?.data?.positionBundleMint || ''}
                  onChange={async (e) => {
                    const mint = e.target.value;
                    if (!mint) {
                      setLoadedBundle(null);
                      setNftAddressInput('');
                      return;
                    }
                    setNftAddressInput(mint);
                    const bundle = positionBundles.find(b => b.data?.positionBundleMint === mint);
                    if (bundle) {
                      setLoadedBundle(bundle);
                      addLog(`Loaded bundle: ${bundle.name || mint}`, 'success');
                    }
                  }}
                  disabled={!publicKey || bundlesLoading}
                >
                  <option value="">-- New Bundle --</option>
                  {positionBundles.map((bundle, idx) => (
                    <option key={idx} value={bundle.data?.positionBundleMint || bundle.address?.toString()}>
                      {bundle.name || `Bundle ${idx + 1}`} ({bundle.occupiedCount || 0}/256)
                    </option>
                  ))}
                </select>
                <button
                  className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2 py-1 text-zinc-300 text-[10px] uppercase"
                  onClick={fetchOwnerBundles}
                  disabled={bundlesLoading || !publicKey}
                >
                  {bundlesLoading ? '...' : 'REFRESH'}
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Load Pool</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-black border border-zinc-700 px-3 py-2 text-zinc-300 text-xs font-mono placeholder-zinc-600"
                  placeholder="Paste pool address..."
                  value={bundlePoolAddressInput}
                  onChange={(e) => setBundlePoolAddressInput(e.target.value)}
                />
                <button
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 font-bold uppercase tracking-widest disabled:opacity-50 shrink-0 text-[10px]"
                  onClick={async () => {
                    if (!bundlePoolAddressInput.trim()) return;
                    addLog(`Loading pool: ${bundlePoolAddressInput}`, 'info');
                    try {
                      const poolData = await getPoolData(bundlePoolAddressInput.trim(), rpcUrl, network);
                      setLoadedPoolData(poolData);
                      addLog(`Pool loaded: ${poolData.tokenA.symbol}/${poolData.tokenB.symbol} @ ${poolData.currentPrice.toFixed(6)}`, 'success');
                    } catch (err: any) {
                      addLog(`Failed to load pool: ${err.message}`, 'error');
                    }
                  }}
                  disabled={!bundlePoolAddressInput.trim() || isLoading}
                >
                  LOAD POOL
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Load Bundle</h2>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-black border border-zinc-700 px-3 py-2 text-zinc-300 text-xs font-mono placeholder-zinc-600"
                  placeholder="Paste Bundle Mint..."
                  value={nftAddressInput}
                  onChange={(e) => setNftAddressInput(e.target.value)}
                />
                <button
                  className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 font-bold uppercase tracking-widest disabled:opacity-50 shrink-0 text-[10px]"
                  onClick={async () => {
                    if (!nftAddressInput.trim()) return;
                    addLog(`Loading bundle from address: ${nftAddressInput}`, 'info');
                    try {
                      await loadAndDisplayBundle(nftAddressInput.trim(), addLog);
                      const response = await fetch(`/api/bundle-cache?mint=${nftAddressInput.trim()}`);
                      if (response.ok) {
                        const cached = await response.json();
                        if (cached) {
                          setLoadedBundle(cached);
                          addLog(`Loaded cached bundle: ${cached.name || nftAddressInput}`, 'success');
                          addLog(`RAW BUNDLE DATA:\n${JSON.stringify(cached.data, (key, value) => typeof value === 'bigint' ? value.toString() : value instanceof Uint8Array ? Array.from(value) : value, 2)}`, 'info');
                          return;
                        }
                      }
                      addLog('Bundle not in cache - enter details manually or fetch from chain', 'warning');
                    } catch (err) {
                      addLog(`Failed to load bundle: ${err}`, 'error');
                    }
                  }}
                  disabled={!nftAddressInput.trim() || isLoading}
                >
                  LOAD BUNDLE
                </button>
              </div>
            </div>

            {selectedWhirlpool ? (
              <>
                <div className="mt-2 p-2 bg-cyan-950/20 border border-cyan-900 text-cyan-500 flex justify-between items-center gap-4">
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <span className="truncate text-zinc-400 text-[10px]"><span className="text-cyan-400">{selectedWhirlpool.address}</span></span>
                  </div>
                  <button
                    className="bg-cyan-600 text-white px-4 py-2 font-bold uppercase tracking-widest hover:bg-cyan-500 disabled:opacity-50 shrink-0 text-[10px]"
                    onClick={initializeBundle}
                    disabled={isLoading || !publicKey}
                  >
                    INITIALIZE BUNDLE
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-2 space-y-3">
                <div className="p-2 bg-zinc-900/50 border border-zinc-800">
                  <label className="text-zinc-500 text-[10px] uppercase block mb-1">Paste Bundle Address to Load:</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-black border border-zinc-700 px-2 py-1.5 text-zinc-300 text-xs font-mono"
                      placeholder="Bundle mint address..."
                      value={nftAddressInput}
                      onChange={(e) => setNftAddressInput(e.target.value)}
                    />
                    <button
                      className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 text-[10px] uppercase font-bold disabled:opacity-50"
                      onClick={async () => {
                        if (!nftAddressInput.trim()) return;
                        addLog(`Loading bundle from address: ${nftAddressInput}`, 'info');
                        try {
                          // First display the bundle info in the console
                          await loadAndDisplayBundle(nftAddressInput.trim(), addLog);

                          // Then load it in the UI
                          const response = await fetch(`/api/bundle-cache?mint=${nftAddressInput.trim()}`);
                          if (response.ok) {
                            const cached = await response.json();
                            if (cached) {
                              setLoadedBundle(cached);
                              addLog(`Loaded cached bundle: ${cached.name || nftAddressInput}`, 'success');
                              addLog(`RAW BUNDLE DATA:\n${JSON.stringify(cached.data, (key, value) => typeof value === 'bigint' ? value.toString() : value instanceof Uint8Array ? Array.from(value) : value, 2)}`, 'info');
                              return;
                            }
                          }
                          addLog('Bundle not in cache - enter details manually or fetch from chain', 'warning');
                        } catch (err) {
                          addLog(`Failed to load bundle: ${err}`, 'error');
                        }
                      }
                      addLog('Bundle not in cache - enter details manually or fetch from chain', 'warning');
                    } catch (err) {
                      addLog(`Failed to load bundle: ${err}`, 'error');
                    }
                  }}
                  disabled={!nftAddressInput.trim() || isLoading}
                >
                  LOAD BUNDLE
                </button>
              </div>
            </div>

            {selectedWhirlpool && (
              <>
                <div className="mt-2 p-2 bg-cyan-950/20 border border-cyan-900 text-cyan-500 flex justify-between items-center gap-4">
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <span className="truncate text-zinc-400 text-[10px]"><span className="text-cyan-400">{selectedWhirlpool.address}</span></span>
                  </div>
                  <button
                    className="bg-cyan-600 text-white px-4 py-2 font-bold uppercase tracking-widest hover:bg-cyan-500 disabled:opacity-50 shrink-0 text-[10px]"
                    onClick={initializeBundle}
                    disabled={isLoading || !publicKey}
                  >
                    INITIALIZE BUNDLE
                  </button>
                </div>
              </>
            )}
            <div className="mt-6 pt-4 border-t border-zinc-800">

              <div className="flex flex-col gap-4">
                {/* 1. DEFAULT IMAGE URL SECTION */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4 relative">
                    <span className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Metadata</span>
                    <span className="text-zinc-500 text-xs">DEFAULTIMG=</span>
                    {editingDefaultImg ? (
                      <>
                        <span className="text-zinc-400 text-xs truncate max-w-[200px]">{tempDefaultImgUrl || 'Not set'}</span>
                        <button
                          className={`px-2 py-1 text-xs uppercase tracking-wider transition-colors ${imageChanged ? 'bg-green-800 hover:bg-green-700 text-green-100' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'} border border-zinc-700`}
                          onClick={async () => {
                            const newEnv = env.includes('DEFAULTIMG=')
                              ? env.replace(/DEFAULTIMG=[^\n]*/, `DEFAULTIMG=${tempDefaultImgUrl}`)
                              : env + `\nDEFAULTIMG=${tempDefaultImgUrl}`;

                            setEnv(newEnv);
                            setDefaultImageUrl(tempDefaultImgUrl);

                            await fetch('/api/env', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ env: newEnv }),
                            });

                            addLog('Default image URL saved', 'success');
                            setEditingDefaultImg(false);
                            setImgEditMode(null);
                            setImageChanged(false);
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2 py-1 text-zinc-300 text-xs uppercase tracking-wider transition-colors"
                          onClick={() => {
                            setEditingDefaultImg(false);
                            setImgEditMode(null);
                            setTempDefaultImgUrl(defaultImageUrl);
                            setImageChanged(false);
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="inline-flex items-center">
                          <span className="text-zinc-400 text-xs truncate max-w-[200px]">{defaultImageUrl || 'Not set'}</span>

                          <Select.Root
                            onValueChange={(val) => {
                              setImgEditMode(val as 'from-saved' | 'browse' | 'load-url');
                            }}
                            onOpenChange={(open) => setEditingDefaultImg(open)}
                          >
                            <Select.Trigger className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 ml-2 px-2 py-1 text-zinc-300 text-[10px] uppercase tracking-wider transition-colors">
                              Edit
                            </Select.Trigger>

                            <Select.Content side="top" align="end" className="bg-zinc-900 border border-zinc-700 p-0.5 w-40 shadow-lg">
                              <Select.Viewport className="p-0.5">
                                <Select.Item value="from-saved" className="px-2 py-0.5 text-[10px] font-mono text-zinc-300 uppercase hover:bg-zinc-800">
                                  <Select.ItemText>FROM SAVED</Select.ItemText>
                                </Select.Item>
                                <Select.Item value="browse" className="px-2 py-0.5 text-[10px] font-mono text-zinc-300 uppercase hover:bg-zinc-800">
                                  <Select.ItemText>BROWSE</Select.ItemText>
                                </Select.Item>
                                <Select.Item value="load-url" className="px-2 py-0.5 text-[10px] font-mono text-zinc-300 uppercase hover:bg-zinc-800">
                                  <Select.ItemText>ENTER URL</Select.ItemText>
                                </Select.Item>
                              </Select.Viewport>
                            </Select.Content>
                          </Select.Root>
                        </div>
                      </>
                    )}
                    {defaultImageUrl && (
                      <img src={defaultImageUrl} alt="Default" className="w-8 h-8 object-cover border border-zinc-700" />
                    )}
                  </div>

                  {/* FROM SAVED DROPDOWN */}
                  {editingDefaultImg && imgEditMode === 'from-saved' && (
                    <div className="bg-zinc-900 border border-zinc-700 p-2 space-y-2">
                      <div className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Select from saved images:</div>
                      <select
                        className="w-full bg-black border border-zinc-700 px-2 py-1.5 text-zinc-300 text-xs"
                        onChange={(e) => {
                          if (e.target.value) {
                            setTempDefaultImgUrl(e.target.value);
                            setImageChanged(true);
                          }
                        }}
                        value=""
                      >
                        <option value="">-- Select an image --</option>
                        {savedImageKeys.map((img) => (
                          <option key={img.key} value={img.value} title={img.key}>
                            {img.key}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 bg-zinc-700 hover:bg-zinc-600 px-2 py-1 text-zinc-300 text-xs uppercase"
                          onClick={() => setImgEditMode(null)}
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* BROWSE OPTION */}
                  {editingDefaultImg && imgEditMode === 'browse' && (
                    <div className="bg-zinc-900 border border-zinc-700 p-2 space-y-2">
                      <div className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Browse file system:</div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const result = event.target?.result as string;
                              setTempDefaultImgUrl(result);
                              setImageChanged(true);
                              addLog('Image file loaded', 'success');
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="block w-full text-xs text-zinc-400 file:bg-zinc-800 file:text-zinc-100 file:border file:border-zinc-700 file:px-2 file:py-1 file:rounded"
                      />
                      <div className="flex gap-2">
                        <button
                          className="flex-1 bg-zinc-700 hover:bg-zinc-600 px-2 py-1 text-zinc-300 text-xs uppercase"
                          onClick={() => setImgEditMode(null)}
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* LOAD URL OPTION */}
                  {editingDefaultImg && imgEditMode === 'load-url' && (
                    <div className="bg-zinc-900 border border-zinc-700 p-2 space-y-2">
                      <div className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Enter image URL:</div>
                      <input
                        type="text"
                        className="w-full bg-black border border-zinc-700 px-2 py-1.5 text-zinc-300 text-xs font-mono"
                        placeholder="https://..."
                        value={tempDefaultImgUrl}
                        onChange={(e) => {
                          setTempDefaultImgUrl(e.target.value);
                          setImageChanged(true);
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          className="flex-1 bg-zinc-700 hover:bg-zinc-600 px-2 py-1 text-zinc-300 text-xs uppercase"
                          onClick={() => setImgEditMode(null)}
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. BUNDLE METADATA INPUTS */}
                <div className="flex items-center gap-4">
                  <label className="text-zinc-500 text-xs uppercase">Name</label>
                  <input
                    className="bg-black border border-zinc-800 p-1 text-zinc-300 text-sm w-32"
                    placeholder="Bundle Name"
                    value={bundleName || ""}
                    onChange={(e) => setBundleName(e.target.value)}
                  />
                  <label className="text-zinc-500 text-xs uppercase">Sym</label>
                  <input
                    className="bg-black border border-zinc-800 p-1 text-zinc-300 text-sm w-20"
                    placeholder="SYM"
                    value={bundleSymbol || ""}
                    onChange={(e) => setBundleSymbol(e.target.value)}
                  />

                  <button
                    className="bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-500/30 px-3 py-1 text-cyan-400 text-xs uppercase tracking-wider transition-colors"
                    onClick={async () => {
                      const bundleMint = loadedBundle?.data?.positionBundleMint || rawBundleData?.positionBundleMint;
                      const whirlpool = loadedBundle?.data?.whirlpool || rawBundleData?.whirlpool || selectedWhirlpool?.address;
                      const owner = publicKey?.toBase58() || loadedBundle?.data?.owner || rawBundleData?.owner;

                      const metadata = {
                        name: bundleName || "Whirlpool Position Bundle",
                        symbol: bundleSymbol || "WPB",
                        description: "A bundle of 256 liquidity positions in Orca Whirlpools",
                        external_url: "https://orca.so",
                        attributes: [
                          { trait_type: "Type", value: "Position Bundle" },
                          { trait_type: "Capacity", value: "256 positions" },
                          ...(bundleMint ? [{ trait_type: "Mint", value: bundleMint }] : []),
                          ...(whirlpool ? [{ trait_type: "Whirlpool", value: whirlpool }] : []),
                          ...(owner ? [{ trait_type: "Owner", value: owner }] : [])
                        ]
                      };

                      addLog('Uploading metadata to Pinata...', 'info');

                      try {
                        const res = await fetch('/api/pinata', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'createBundleMetadata',
                            jsonData: metadata
                          })
                        });

                        const result = await res.json();

                        if (res.ok && result.success) {
                          addLog(`Metadata stored! CID: ${result.cid}`, 'success');
                          addLog(`URI: ${result.metadataUrl}`, 'success');
                        } else {
                          addLog(`Pinata upload failed: ${result.error || 'Unknown error'}`, 'error');
                        }
                      } catch (err: any) {
                        addLog(`Network error: ${err.message}`, 'error');
                      }
                    }}
                  >
                    Save to Pinata
                  </button>
                </div>
              </div>


              <div className="border-t border-zinc-800 mt-6 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Add Positions to Bundle</span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 bg-purple-800 text-white py-1 px-3 font-bold uppercase tracking-widest hover:bg-purple-700 text-[10px] border border-purple-700 disabled:opacity-50"
                    onClick={handleAddEmptyPositions}
                    disabled={isLoading || !loadedBundle}
                  >
                    {isLoading ? '...' : '+ EMPTY POSITIONS'}
                  </button>
                  <button
                    className="flex-1 bg-green-800 text-white py-1 px-3 font-bold uppercase tracking-widest hover:bg-green-700 text-[10px] border border-green-700 disabled:opacity-50"
                    onClick={handleAddLiquidityAndPositions}
                    disabled={isLoading || !loadedBundle || !fundAmount}
                  >
                    {isLoading ? '...' : '+ LIQUIDITY & POSITIONS'}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex flex-col gap-2">
                  <label className="text-zinc-500">NFT ADDRESS</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-black border border-zinc-800 p-1 text-zinc-300"
                      placeholder="Paste bundle NFT address..."
                      value={nftAddressInput}
                      onChange={(e) => setNftAddressInput(e.target.value)}
                    />
                    <button
                      className="bg-cyan-900/30 text-cyan-500 border border-cyan-500/30 px-3 hover:bg-cyan-900/50 transition-colors disabled:opacity-50"
                      onClick={loadBundleByNft}
                      disabled={bundleLoading}
                    >
                      {bundleLoading ? '...' : 'LOAD'}
                    </button>
                  </div>
                  {loadedBundle && (
                    <div className="text-[10px] text-green-500 mt-1">
                      Bundle loaded: {bundlePositionCount} positions
                      {loadedPoolData && (
                        <span className="text-cyan-400 ml-2">
                          | Pool: {loadedPoolData.tokenA.symbol}/{loadedPoolData.tokenB.symbol}
                        </span>
                      )}
                    </div>
                  )}
                  <label className="text-zinc-500 mt-2">% RANGE PER POSITION</label>
                  <input
                    className="bg-black border border-zinc-800 p-1 text-zinc-300"
                    value={rangePercent || ""}
                    onChange={(e) => setRangePercent(e.target.value)}
                  />
                  <label className="text-zinc-500 mt-2">NUMBER OF POSITIONS</label>
                  <input
                    className="bg-black border border-zinc-800 p-1 text-zinc-300"
                    value={numPositions || ""}
                    onChange={(e) => setNumPositions(e.target.value)}
                  />

                  <div className="flex gap-2 mt-2">
                    <div className="flex flex-col gap-2 flex-1">
                      <label className="text-zinc-500 text-[10px]">TOTAL RANGE</label>
                      <input
                        className="bg-black border border-zinc-800 p-1 text-zinc-300"
                        value={`${(parseFloat(rangePercent || '0') * parseFloat(numPositions || '0')).toFixed(2)}%`}
                        readOnly
                      />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <label className="text-zinc-500 text-[10px]">TOTAL PRICE RANGE</label>
                      <input
                        className="bg-black border border-zinc-800 p-1 text-zinc-300"
                        value={(() => {
                          const currentPrice = parseFloat(poolMetadata?.price || '0');
                          const totalRangePct = parseFloat(rangePercent || '0') * parseFloat(numPositions || '0');
                          const lowerPrice = (currentPrice * (1 - totalRangePct / 200)).toFixed(6);
                          const upperPrice = (currentPrice * (1 + totalRangePct / 200)).toFixed(6);
                          return `${lowerPrice} - ${upperPrice} SOL`;
                        })()}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">

                  <label className="text-zinc-500">FUND AMOUNT (SOL)</label>
                  <input
                    className="bg-black border border-zinc-800 p-1 text-zinc-300"
                    value={fundAmount || ""}
                    onChange={(e) => setFundAmount(e.target.value)}
                  />
                  <label className="text-zinc-500 mt-2">REINVEST MODE</label>
                  <select
                    className="bg-black border border-zinc-800 p-1 text-zinc-300 outline-none"
                    value={reinvestMode}
                    onChange={(e) => setReinvestMode(e.target.value)}
                  >
                    <option>AUTO REINVEST</option>
                    <option>MANUAL</option>
                  </select>
                  <label className="text-zinc-500 mt-2">HARVEST MODE</label>
                  <select
                    className="bg-black border border-zinc-800 p-1 text-zinc-300 outline-none"
                    value={harvestMode}
                    onChange={(e) => setHarvestMode(e.target.value)}
                  >
                    <option>WHEN PROFITABLE</option>
                    <option>EVERY X MOVES</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center mt-3 py-2 px-4 bg-zinc-900/50 border border-zinc-800">
                <div className="text-left">
                  <div className="text-zinc-500 text-[10px]">48HR LOW</div>
                  <div className="text-red-400 font-bold">{loadedPoolData ? `${(loadedPoolData.currentPrice * 0.95).toFixed(6)}` : (poolMetadata?.low48h ? `${parseFloat(poolMetadata.low48h).toFixed(6)}` : '--')}</div>
                </div>
                <div className="text-center">
                  <div className="text-zinc-500 text-[10px]">CURRENT PRICE</div>
                  <div className="text-cyan-400 font-bold text-sm">{loadedPoolData ? `${loadedPoolData.currentPrice.toFixed(6)}` : (poolMetadata?.price ? `${parseFloat(poolMetadata.price).toFixed(6)}` : '--')}</div>
                </div>
                <div className="text-right">
                  <div className="text-zinc-500 text-[10px]">48HR HIGH</div>
                  <div className="text-green-400 font-bold">{loadedPoolData ? `${(loadedPoolData.currentPrice * 1.05).toFixed(6)}` : (poolMetadata?.high48h ? `${parseFloat(poolMetadata.high48h).toFixed(6)}` : '--')}</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'view-bundle':
        return (
          <div className="p-4 border border-zinc-800 bg-zinc-950 text-xs font-mono">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-tighter">Bundle Management</h2>
              <div className="flex gap-2">
                <button
                  className="px-2 py-1 text-[10px] bg-zinc-800 hover:bg-zinc-700"
                  onClick={fetchOwnerBundles}
                  disabled={bundlesLoading || !publicKey}
                >
                  {bundlesLoading ? 'LOADING...' : 'REFRESH'}
                </button>
                <button className={`px-2 py-1 text-[10px] ${monitoringActive ? 'bg-red-900' : 'bg-green-900'}`} onClick={() => setMonitoringActive(!monitoringActive)}>
                  {monitoringActive ? 'STOP LOOP' : 'RUN LOOP'}
                </button>
              </div>
            </div>
            {!publicKey ? (
              <div className="flex flex-col items-center justify-center h-40 border border-dashed border-zinc-800 text-zinc-600">
                Connect wallet to view bundles
              </div>
            ) : bundlesLoading ? (
              <div className="flex flex-col items-center justify-center h-40 border border-dashed border-zinc-800 text-zinc-600">
                Loading position bundles...
              </div>
            ) : positionBundles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 border border-dashed border-zinc-800 text-zinc-600">
                No position bundles found for this wallet
              </div>
            ) : (
              <div className="space-y-2">
                {positionBundles.map((bundle, idx) => {
                  const isMinimized = minimizedBundles.has(idx);
                  return (
                    <div key={idx} className="border border-zinc-800 bg-zinc-900 hover:border-zinc-600 transition-colors">
                      <div className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-6 flex-1">
                          <div className="flex items-center gap-2">
                            {bundle.uri && (
                              <div className="w-6 h-6 bg-zinc-800 rounded overflow-hidden flex items-center justify-center shrink-0">
                                <img
                                  src={bundle.uri}
                                  alt={bundle.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="text-zinc-100 font-bold text-xs">{bundle.name}</div>
                            <div className="text-zinc-500 text-[9px]">{bundle.symbol}</div>
                          </div>

                          <span
                            className="text-[9px] text-cyan-500 cursor-pointer hover:underline"
                            onClick={() => copyToClipboard(bundle.address?.toString() || '')}
                          >
                            {bundle.address?.toString().slice(0, 6)}...{bundle.address?.toString().slice(-6)}
                          </span>

                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-500 text-[9px]">POS:</span>
                              <span className="text-cyan-400 font-bold text-[10px]">{bundle.occupiedCount}/256</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-500 text-[9px]">LIQ:</span>
                              <span className="text-green-400 font-bold text-[10px]">{bundle.totalLiquiditySol?.toFixed(4) || '0.0000'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-500 text-[9px]">IDX:</span>
                              <span className="text-yellow-400 font-bold text-[10px]">{bundle.occupiedIndices?.[0] ?? 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-500 text-[9px]">PRICE:</span>
                              <span className="text-purple-400 font-bold text-[10px]">{bundle.currentPrice?.toFixed(6) || '--'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-[9px] ml-2">
                          <div className="flex items-center gap-2">
                            <div>
                              <span className="text-zinc-500">MINT: </span>
                              <span
                                className="text-zinc-300 cursor-pointer hover:text-cyan-400"
                                onClick={() => copyToClipboard(bundle.data?.positionBundleMint?.toString() || '')}
                              >
                                {bundle.data?.positionBundleMint?.toString().slice(0, 12)}...
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-500">URI: </span>
                              <span className="text-zinc-300">{bundle.uri?.slice(0, 30) || 'N/A'}...</span>
                            </div>
                          </div>
                          <button className="px-3 py-1 text-[9px] font-bold tracking-wider uppercase bg-cyan-500 hover:bg-cyan-400 text-black transition-colors">
                            Open Manager
                          </button>
                          <button
                            onClick={() => handleDeleteBundle(idx)}
                            disabled={isLoading}
                            className="px-3 py-1 text-[9px] font-bold tracking-wider uppercase bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoading ? '...' : 'Delete'}
                          </button>
                          <button
                            onClick={() => toggleBundleMinimize(idx)}
                            className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors text-sm font-mono shrink-0"
                          >
                            {isMinimized ? '+' : '-'}
                          </button>
                        </div>
                      </div>

                      {!isMinimized && (
                        <div className="px-2 pb-2 border-t border-zinc-800">

                          {bundle.occupiedIndices && bundle.occupiedIndices.length > 0 && (
                            <div className="pt-1">
                              <div className="text-zinc-500 text-[9px] uppercase mb-1">Positions ({bundle.occupiedCount})</div>
                              <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                                {bundle.occupiedIndices.map((posIndex: number, posIdx: number) => {
                                  const key = `${idx}-${posIndex}`;
                                  const isExpanded = expandedPositions.has(key);
                                  const details = positionDetails.get(key);
                                  const isLoading = loadingPositions.has(key);
                                  const isInRange = details && bundle.currentPrice
                                    ? bundle.currentPrice >= details.lowerPrice && bundle.currentPrice <= details.upperPrice
                                    : false;

                                  return (
                                    <div
                                      key={posIndex}
                                      className={`text-[9px] ${isInRange
                                        ? 'bg-green-500/10 border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                                        : 'bg-zinc-900/50 border border-zinc-800'
                                        }`}
                                    >
                                      <div className="flex items-center justify-between px-2 py-1.5">
                                        <div className="flex items-center gap-3">
                                          <span className={`font-mono font-bold w-8 ${isInRange ? 'text-green-400' : 'text-zinc-500'}`}>#{posIndex.toString().padStart(3, '0')}</span>
                                          {details && !details.error ? (
                                            <div className="flex items-center gap-4">
                                              <div className="flex items-center gap-1">
                                                <span className="text-zinc-600">RANGE:</span>
                                                <span className={isInRange ? 'text-green-400' : 'text-zinc-400'}>
                                                  {details.lowerPrice.toFixed(6)} - {details.upperPrice.toFixed(6)} SOL
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span className="text-zinc-600">LIQ:</span>
                                                <span className="text-cyan-400">{(Number(details.liquidity) / 1e9).toFixed(4)} SOL</span>
                                              </div>
                                            </div>
                                          ) : isLoading ? (
                                            <span className="text-zinc-600 animate-pulse">Loading...</span>
                                          ) : details?.error ? (
                                            <span className="text-red-500 text-[8px]">{details.error}</span>
                                          ) : (
                                            <span className="text-zinc-600">Click MANAGE to load details</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {isInRange && (
                                            <span className="text-[8px] bg-green-500 text-black px-1 font-bold animate-pulse">IN RANGE</span>
                                          )}
                                          <button
                                            onClick={() => {
                                              if (!details && !isLoading) {
                                                fetchPositionDetails(idx, bundle, posIndex);
                                              }
                                              togglePositionExpand(idx, posIndex);
                                            }}
                                            className="px-2 py-0.5 text-[8px] font-bold uppercase bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                                          >
                                            {isExpanded ? '−' : 'MANAGE'}
                                          </button>
                                        </div>
                                      </div>

                                      {isExpanded && (
                                        <div className="px-2 pb-2 border-t border-zinc-800 mt-1 pt-2">
                                          {isLoading ? (
                                            <div className="text-zinc-600 animate-pulse text-center py-2">Loading position data...</div>
                                          ) : details && !details.error ? (
                                            <div className="space-y-2">
                                              <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-zinc-950 p-2 border border-zinc-800">
                                                  <div className="text-zinc-600 text-[8px] uppercase mb-0.5">Total Earned (Fees)</div>
                                                  <div className="text-yellow-400 font-mono text-[10px]">
                                                    A: {(Number(details.feeOwedA) / 1e9).toFixed(6)} | B: {(Number(details.feeOwedB) / 1e6).toFixed(4)}
                                                  </div>
                                                  <div className="text-zinc-600 text-[7px] mt-1">
                                                    Checkpoints: {details.feeGrowthCheckpointA.slice(0, 8)}... / {details.feeGrowthCheckpointB.slice(0, 8)}...
                                                  </div>
                                                </div>
                                                <div className="bg-zinc-950 p-2 border border-zinc-800">
                                                  <div className="text-zinc-600 text-[8px] uppercase mb-0.5">Reward Info</div>
                                                  <div className="space-y-0.5">
                                                    {details.rewardInfos && details.rewardInfos.length > 0 ? (
                                                      details.rewardInfos.map((reward: any, rIdx: number) => (
                                                        <div key={rIdx} className="text-[8px]">
                                                          <span className="text-zinc-600">Slot {rIdx}: </span>
                                                          <span className="text-purple-400">
                                                            {reward.amountOwed?.toString() || '0'} owed
                                                          </span>
                                                        </div>
                                                      ))
                                                    ) : (
                                                      <span className="text-zinc-600 text-[8px]">No rewards</span>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="flex gap-1 pt-1">
                                                <button className="flex-1 py-1 text-[8px] font-bold uppercase bg-green-600 hover:bg-green-500 text-white transition-colors">
                                                  Add Liquidity
                                                </button>
                                                <button className="flex-1 py-1 text-[8px] font-bold uppercase bg-orange-600 hover:bg-orange-500 text-white transition-colors">
                                                  Remove
                                                </button>
                                                <button className="flex-1 py-1 text-[8px] font-bold uppercase bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                                                  Move Range
                                                </button>
                                                <button className="flex-1 py-1 text-[8px] font-bold uppercase bg-red-600 hover:bg-red-500 text-white transition-colors">
                                                  Close
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="text-red-500 text-center py-2">{details?.error || 'Failed to load'}</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-400 selection:bg-zinc-800 selection:text-zinc-100 flex flex-col p-2 gap-2 overflow-hidden h-screen">
      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-zinc-800 pb-2 shrink-0">
        {(['config', 'search', 'latest', 'create-bundle', 'view-bundle', 'docs', 'files'] as Dashboard[]).map((d) => (
          <button
            key={d}
            onClick={() => setActiveDashboard(d)}
            className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap ${activeDashboard === d ? 'bg-zinc-100 text-black border-zinc-100' : 'border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
              }`}
          >
            {d.replace('-', ' ')}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {renderDashboard()}
      </div>

      <div style={{ height: consoleMinimized ? '28px' : `${consoleHeight}px` }} className="border border-zinc-800 bg-zinc-950 flex flex-col shrink-0 relative transition-all">
        <div onMouseDown={startResizing} className={`absolute -top-1 left-0 right-0 h-2 cursor-ns-resize z-50 hover:bg-cyan-500/20 transition-colors ${consoleMinimized ? 'hidden' : ''}`} />
        <div className="bg-zinc-900 px-2 py-1 text-[9px] font-bold text-zinc-500 flex justify-between items-center border-b border-zinc-800">
          <span>OPERATIONS CONSOLE</span>
          <div className="flex gap-2">
            <button id="bundlemin" onClick={() => setConsoleMinimized(!consoleMinimized)} className="hover:text-zinc-300">
              {consoleMinimized ? 'EXPAND' : 'MINIMIZE'}
            </button>
            <button onClick={() => setLogs([])} className="hover:text-zinc-300">CLEAR</button>
          </div>
        </div>
        <div ref={logRef} className={`flex-1 overflow-y-auto p-2 font-mono text-[10px] leading-tight flex flex-col gap-1 ${consoleMinimized ? 'hidden' : ''}`}>
          {logs.length === 0 && <div className="text-zinc-700 italic">No operations logged yet...</div>}
          {logs.map((log) => (
            <div key={log.id} className="flex gap-2">
              <span className="text-zinc-600 shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
              <span className={`${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-green-500' : 'text-zinc-400'} whitespace-pre-wrap`}>{log.message}</span>

            </div>
          ))}
        </div>
      </div>


      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #09090b; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      `}</style>
    </div>
  );
}
