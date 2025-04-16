export interface Token {
  symbol: string;
  name: string;
  icon: string;
  tokenId?: string;  // Hedera token ID
}

export interface Sector {
  name: string;
  tokens: Token[];
  defaultToken: Token;
  weight: number;  // Adding weight property
}

// Using placeholder icons for now - these should be replaced with actual token icons
export const sectors: Sector[] = [
  {
    name: "Smart Contract Platforms",
    tokens: [
      { symbol: "HBAR", name: "Hedera", tokenId: "0.0.1", icon: "/tokens/hbar.png" },
      { symbol: "WBTC", name: "Wrapped Bitcoin", tokenId: "0.0.359891", icon: "/tokens/wbtc.png" },
      { symbol: "WETH", name: "Wrapped Ethereum", tokenId: "0.0.456858", icon: "/tokens/weth.png" },
      { symbol: "WAVAX", name: "Wrapped Avalanche", tokenId: "0.0.1045891", icon: "/tokens/wavax.png" }
    ],
    defaultToken: { symbol: "HBAR", name: "Hedera", tokenId: "0.0.1", icon: "/tokens/hbar.png" },
    weight: 30
  },
  {
    name: "DeFi & DEX Tokens",
    tokens: [
      { symbol: "SAUCE", name: "SaucerSwap", tokenId: "0.0.1055477", icon: "/tokens/sauce.png" },
      { symbol: "xSAUCE", name: "Staked SAUCE", tokenId: "0.0.1181082", icon: "/tokens/xsauce.png" },
      { symbol: "HBARX", name: "Stader HBARX", tokenId: "0.0.1142659", icon: "/tokens/hbarx.png" },
      { symbol: "HLQT", name: "HeliSwap", tokenId: "0.0.1465801", icon: "/tokens/hlqt.png" }
    ],
    defaultToken: { symbol: "SAUCE", name: "SaucerSwap", tokenId: "0.0.1055477", icon: "/tokens/sauce.png" },
    weight: 25
  },
  {
    name: "Stablecoins",
    tokens: [
      { symbol: "USDC", name: "USD Coin", tokenId: "0.0.456858", icon: "/tokens/usdc.png" },
      { symbol: "USDT", name: "Tether", tokenId: "0.0.456862", icon: "/tokens/usdt.png" },
      { symbol: "DAI", name: "Dai", tokenId: "0.0.456861", icon: "/tokens/dai.png" },
      { symbol: "HCHF", name: "HBAR Franc", tokenId: "0.0.1234567", icon: "/tokens/hchf.png" }
    ],
    defaultToken: { symbol: "USDC", name: "USD Coin", tokenId: "0.0.456858", icon: "/tokens/usdc.png" },
    weight: 20
  },
  {
    name: "Enterprise & Utility Tokens",
    tokens: [
      { symbol: "CLXY", name: "Calaxy", tokenId: "0.0.1234568", icon: "/tokens/clxy.png" },
      { symbol: "DOVU", name: "DOVU", tokenId: "0.0.1234569", icon: "/tokens/dovu.png" },
      { symbol: "HST", name: "HeadStarter", tokenId: "0.0.1234570", icon: "/tokens/hst.png" }
    ],
    defaultToken: { symbol: "CLXY", name: "Calaxy", tokenId: "0.0.1234568", icon: "/tokens/clxy.png" },
    weight: 15
  },
  {
    name: "GameFi & NFT Infrastructure",
    tokens: [
      { symbol: "JAM", name: "Tune.FM", tokenId: "0.0.1234571", icon: "/tokens/jam.png" },
      { symbol: "KARATE", name: "Karate Combat", tokenId: "0.0.1234572", icon: "/tokens/karate.png" },
      { symbol: "PACK", name: "HashPack", tokenId: "0.0.1234573", icon: "/tokens/pack.png" },
      { symbol: "GRELF", name: "GRELF", tokenId: "0.0.1234574", icon: "/tokens/grelf.png" },
      { symbol: "STEAM", name: "STEAM", tokenId: "0.0.1234575", icon: "/tokens/steam.png" }
    ],
    defaultToken: { symbol: "JAM", name: "Tune.FM", tokenId: "0.0.1234571", icon: "/tokens/jam.png" },
    weight: 10
  }
];