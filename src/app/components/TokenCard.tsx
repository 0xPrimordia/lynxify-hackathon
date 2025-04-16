import React, { useState, useEffect } from 'react';
import { Card, Button, Slider, Tooltip } from "@nextui-org/react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";
import { TokenIcon } from './TokenIcon';
import { getTokenStats, TokenStats } from '../utils/hedera';

interface Token {
  symbol: string;
  name: string;
  icon: string;
  tokenId?: string;
}

interface TokenCardProps {
  sector: string;
  tokens: Token[];
  defaultToken: Token;
  weight: number;
  recommendedWeight: number | null;
  onTokenSelect: (token: Token) => void;
  onWeightChange: (weight: number) => void;
}

export const TokenCard: React.FC<TokenCardProps> = ({
  sector,
  tokens,
  defaultToken,
  weight,
  recommendedWeight,
  onTokenSelect,
  onWeightChange,
}) => {
  const [selectedToken, setSelectedToken] = useState<Token>(defaultToken);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchTokenStats = async () => {
      if (!selectedToken.tokenId) return;
      
      setIsLoading(true);
      try {
        const stats = await getTokenStats(selectedToken.tokenId);
        if (stats) {
          setTokenStats(stats);
        }
      } catch (error) {
        console.error('Error fetching token stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokenStats();
  }, [selectedToken.tokenId]);

  const handleTokenSelect = (token: Token) => {
    setSelectedToken(token);
    onTokenSelect(token);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const weightDifference = recommendedWeight 
    ? (weight - recommendedWeight).toFixed(1) 
    : '0';

  return (
    <Card className="p-4 bg-gray-800">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm text-gray-400">{sector}</h3>
            <p className="text-lg font-semibold">{selectedToken.name}</p>
            <p className="text-sm">{selectedToken.symbol}</p>
            {tokenStats && !isLoading && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-400">
                  Market Cap: {formatNumber(tokenStats.marketCap)}
                </p>
                <p className="text-xs text-gray-400">
                  Liquidity: {formatNumber(tokenStats.liquidity)}
                </p>
                <p className="text-xs text-gray-400">
                  24h Volume: {formatNumber(tokenStats.volume24h)}
                </p>
              </div>
            )}
            {isLoading && (
              <div className="mt-2">
                <p className="text-xs text-gray-400">Loading stats...</p>
              </div>
            )}
          </div>
          <Dropdown>
            <DropdownTrigger>
              <Button 
                isIconOnly 
                variant="bordered"
                className="p-0 min-w-[40px] h-[40px] bg-transparent"
              >
                <TokenIcon
                  tokenId={selectedToken.tokenId}
                  symbol={selectedToken.symbol}
                  iconUrl={selectedToken.icon}
                  size={32}
                />
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Token selection"
              onAction={(key) => {
                const token = tokens.find(t => t.symbol === key.toString());
                if (token) handleTokenSelect(token);
              }}
              items={tokens}
            >
              {(token) => (
                <DropdownItem key={token.symbol}>
                  <div className="flex items-center gap-2">
                    <TokenIcon
                      tokenId={token.tokenId}
                      symbol={token.symbol}
                      iconUrl={token.icon}
                      size={24}
                    />
                    <span>{token.name}</span>
                  </div>
                </DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Weight</span>
            <Tooltip
              content={`Recommended: ${recommendedWeight?.toFixed(1)}% (${Number(weightDifference) >= 0 ? '+' : ''}${weightDifference}%)`}
              placement="top"
            >
              <span className="text-sm font-medium">
                {weight}%
                {recommendedWeight && (
                  <span className={`ml-1 text-xs ${Number(weightDifference) > 0 ? 'text-green-400' : Number(weightDifference) < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    ({Number(weightDifference) >= 0 ? '+' : ''}{weightDifference}%)
                  </span>
                )}
              </span>
            </Tooltip>
          </div>
          <Slider 
            aria-label="Sector weight"
            value={weight}
            onChange={(value) => onWeightChange(Array.isArray(value) ? value[0] : value)}
            className="max-w-md"
            step={5}
            maxValue={100}
            minValue={0}
            marks={[
              { value: 0, label: "0%" },
              { value: 50, label: "50%" },
              { value: 100, label: "100%" }
            ]}
          />
        </div>
      </div>
    </Card>
  );
};