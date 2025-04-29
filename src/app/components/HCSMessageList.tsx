import React from 'react';
import { Card } from "@nextui-org/react";
import { HCSMessage, RebalanceProposal, RebalanceApproved, RebalanceExecuted } from '../services/hedera';

interface HCSMessageListProps {
  messages: HCSMessage[];
  title: string;
}

const isRebalanceProposal = (message: HCSMessage): message is RebalanceProposal => {
  return message.type === "RebalanceProposal";
};

const isRebalanceApproved = (message: HCSMessage): message is RebalanceApproved => {
  return message.type === "RebalanceApproved";
};

const isRebalanceExecuted = (message: HCSMessage): message is RebalanceExecuted => {
  return message.type === "RebalanceExecuted";
};

export const HCSMessageList: React.FC<HCSMessageListProps> = ({ messages, title }) => {
  return (
    <Card className="p-4 bg-gray-800">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="space-y-4">
        {messages.map((message, index) => (
          <div key={index} className="bg-gray-700 p-4 rounded">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-sm text-gray-400">Type: {message.type}</span>
                <p className="text-sm text-gray-400">ID: {message.proposalId}</p>
                <p className="text-sm text-gray-400">
                  Time: {new Date(
                    isRebalanceProposal(message) ? message.executeAfter :
                    isRebalanceApproved(message) ? message.approvedAt :
                    message.executedAt
                  ).toLocaleString()}
                </p>
              </div>
            </div>
            {isRebalanceProposal(message) && (
              <div className="mt-2">
                <h3 className="text-sm font-semibold">New Weights:</h3>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {Object.entries(message.newWeights).map(([token, weight]) => (
                    <div key={token} className="text-sm">
                      {token}: {weight}%
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isRebalanceExecuted(message) && (
              <div className="mt-2">
                <h3 className="text-sm font-semibold">Balances:</h3>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <h4 className="text-xs text-gray-400">Before:</h4>
                    {Object.entries(message.preBalances).map(([token, amount]) => (
                      <div key={token} className="text-sm">
                        {token}: {amount}
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-xs text-gray-400">After:</h4>
                    {Object.entries(message.postBalances).map(([token, amount]) => (
                      <div key={token} className="text-sm">
                        {token}: {amount}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}; 