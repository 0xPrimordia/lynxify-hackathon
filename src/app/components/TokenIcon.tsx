import React, { useState } from 'react';
import Image from 'next/image';
import { getTokenImageUrl } from '../utils/hedera';

interface TokenIconProps {
    tokenId?: string;
    symbol: string;
    iconUrl?: string;
    size?: number;
    className?: string;
}

export const TokenIcon: React.FC<TokenIconProps> = ({
    tokenId,
    symbol,
    iconUrl,
    size = 32,
    className = '',
}) => {
    const [imgError, setImgError] = useState(false);
    
    const getFallbackImage = () => {
        return `data:image/svg+xml,${encodeURIComponent(`
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#2D3748"/>
                <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-family="Arial" font-size="${size/2}">
                    ${symbol.charAt(0)}
                </text>
            </svg>
        `)}`;
    };

    // Ensure imgSrc is always a string
    const imgSrc = imgError || (!tokenId && !iconUrl) 
        ? getFallbackImage()
        : (tokenId ? getTokenImageUrl(tokenId) : iconUrl!) as string;

    return (
        <div 
            className={`relative rounded-full overflow-hidden ${className}`}
            style={{ width: size, height: size }}
        >
            <Image
                src={imgSrc}
                alt={`${symbol} icon`}
                width={size}
                height={size}
                onError={() => setImgError(true)}
                className="object-cover"
                priority
            />
        </div>
    );
};