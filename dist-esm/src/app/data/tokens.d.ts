export interface Token {
    symbol: string;
    name: string;
    icon: string;
    tokenId?: string;
}
export interface Sector {
    name: string;
    tokens: Token[];
    defaultToken: Token;
    weight: number;
}
export declare const sectors: Sector[];
