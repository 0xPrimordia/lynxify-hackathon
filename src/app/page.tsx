"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button } from "@nextui-org/react";
import { sectors as initialSectors } from './data/tokens';
import { TokenCard } from './components/TokenCard';
import { WeightBar } from './components/WeightBar';
import { publishGovernanceSettings } from './api/mock';
import { calculateOptimalComposition } from './services/composition';

const GovernanceDashboard = () => {
  const [sectors, setSectors] = useState(initialSectors);
  const [totalWeight, setTotalWeight] = useState(100);
  const [isValid, setIsValid] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optimalComposition, setOptimalComposition] = useState<any>(null);

  useEffect(() => {
    const fetchOptimalComposition = async () => {
      try {
        const composition = await calculateOptimalComposition(sectors);
        setOptimalComposition(composition);
      } catch (error) {
        console.error('Error calculating optimal composition:', error);
      }
    };

    fetchOptimalComposition();
  }, []);

  useEffect(() => {
    const total = sectors.reduce((sum, sector) => sum + sector.weight, 0);
    setTotalWeight(total);
    setIsValid(total === 100);
  }, [sectors]);

  const handleTokenSelect = async (sectorName: string, token: any) => {
    const updatedSectors = sectors.map(sector => 
      sector.name === sectorName 
        ? { ...sector, defaultToken: token }
        : sector
    );
    setSectors(updatedSectors);
  };

  const handleWeightChange = (sectorName: string, newWeight: number) => {
    const sector = sectors.find(s => s.name === sectorName);
    if (!sector) return;

    const otherSectors = sectors.filter(s => s.name !== sectorName);
    const otherWeight = otherSectors.reduce((sum, s) => sum + s.weight, 0);
    
    const remainingWeight = Math.max(0, 100 - otherWeight);
    const adjustedWeight = Math.min(newWeight, remainingWeight);

    const updatedSectors = sectors.map(sector => 
      sector.name === sectorName 
        ? { ...sector, weight: adjustedWeight }
        : sector
    );
    
    setSectors(updatedSectors);
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    
    setIsSubmitting(true);
    try {
      const settings = {
        sectorWeights: sectors.map(sector => ({
          sector: sector.name,
          token: sector.defaultToken.symbol,
          weight: sector.weight
        })),
        liquidityThreshold: 10,
        stopLoss: 5
      };

      await publishGovernanceSettings(settings);
      console.log('Governance settings published successfully');
    } catch (error) {
      console.error('Failed to publish governance settings:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRecommendedWeight = (sectorName: string) => {
    if (!optimalComposition) return null;
    const sectorComposition = optimalComposition.find(
      (comp: any) => comp.sector === sectorName
    );
    return sectorComposition?.weights[0]?.weight || null;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-blue-600 text-white p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-bold">Governance Dashboard</h1>
            <p className={`text-sm mt-2 ${isValid ? 'text-green-400' : 'text-red-400'}`}>
              Total Weight: {totalWeight}%
              {!isValid && totalWeight < 100 && ' (Needs more allocation)'}
              {!isValid && totalWeight > 100 && ' (Exceeds 100%)'}
            </p>
          </div>
          <Button
            color={isValid ? "success" : "primary"}
            isDisabled={!isValid}
            isLoading={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Publishing..." : "Submit Changes"}
          </Button>
        </div>
        <WeightBar totalWeight={totalWeight} />
      </header>
      <main className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectors.map((sector) => {
            const recommendedWeight = getRecommendedWeight(sector.name);
            return (
              <TokenCard
                key={sector.name}
                sector={sector.name}
                tokens={sector.tokens}
                defaultToken={sector.defaultToken}
                weight={sector.weight}
                recommendedWeight={recommendedWeight}
                onTokenSelect={(token) => handleTokenSelect(sector.name, token)}
                onWeightChange={(weight) => handleWeightChange(sector.name, weight)}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default GovernanceDashboard;
