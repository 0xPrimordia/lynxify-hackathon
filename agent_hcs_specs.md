# HCS‑10 Agent‑Driven Tokenized Index: Prototype Specification

This document outlines the plan to demonstrate Hedera HCS‑10–powered AI agents for governing and rebalancing a tokenized index. While multiple examples are included, the focus will be on the full “Rebalance Proposal → Execution” flow.

---

## 1. Agent‑Driven Rebalancing via HCS‑10

### Message Flow

1. **Governance Proposal → HCS‑10 Topic**  
   - **UI Action:** User clicks “Propose Rebalance” and submits new target weights.  
   - **HCS‑10 Publish (Topic: `Governance.Proposals`):**  
     ```json
     {
       "type": "RebalanceProposal",
       "proposalId": "P123",
       "newWeights": { "TokenA": 0.30, "TokenB": 0.70 },
       "executeAfter": 1714108800,     
       "quorum": 5000
     }
     ```

2. **Voting & Approval**  
   - Off‑chain vote aggregation reaches quorum & majority.
   - **HCS‑10 Publish (Topic: `Governance.Proposals`):**  
     ```json
     {
       "type": "RebalanceApproved",
       "proposalId": "P123",
       "approvedAt": 1714195200
     }
     ```

3. **Agent Listens & Executes**  
   - **Subscription:** Rebalance Agent subscribes to `Governance.Proposals`.  
   - **On `RebalanceApproved`:**  
     1. Fetch current balances from Mirror Node.  
     2. Calculate deltas to match `newWeights`.  
     3. Call Hedera Token Service to mint/burn or swap tokens.  
     4. **HCS‑10 Publish (Topic: `Agent.Actions`):**  
        ```json
        {
          "type": "RebalanceExecuted",
          "proposalId": "P123",
          "preBalances": { "TokenA": 1000, "TokenB": 2000 },
          "postBalances": { "TokenA": 1500, "TokenB": 1500 },
          "executedAt": 1714202400
        }
        ```

### Benefits

- **Complete HCS‑10 Round‑Trip:** Proposal → Approval → Agent Command → Execution Log  
- **Immutable Audit Trail:** Every step is recorded on‑chain with timestamps.  
- **Structured, Parseable Messages:** Agents unambiguously interpret `type`, payload, and metadata.

---

## 2. Other Salient Agent Examples

| Use‑Case                 | HCS‑10 Topic              | Agent Role & Message Type                   |
|--------------------------|---------------------------|----------------------------------------------|
| **Price‑Feed Agent**     | `Market.PriceFeed`        | Publishes `PriceUpdate` messages (e.g., BTC = $60 000). |
| **Policy Enforcement**   | `Governance.Policies`     | Listens for `PolicyChange`, replies `PolicyUpdated`.    |
| **Risk‑Assessment Agent**| `Agent.Risk`              | Aggregates price + sentiment, publishes `RiskAlert`.   |
| **Treasury Management**  | `Agent.Treasury`          | On directive, reallocates treasury, logs `TreasuryRebalanced`. |

---

## 3. Prototype Scenarios to Demo

1. **Rebalance Demo (Core)**  
   - UI: “Propose Rebalance” button → HCS‑10 messages in real time → Agent executes → Execution log.  
   - Show sequence in terminal or “HCS Monitor” panel.

2. **Price‑Trigger Demo (Add‑On)**  
   - Dummy Price‑Feed Agent emits random `PriceUpdate` every 10 s.  
   - Stop‑Loss Agent listens on `Market.PriceFeed` + `Governance.Policies`.  
   - On ≥10 % drop vs. 24 h high, emits `StopLossTriggered` and rebalances into stablecoin.

3. **Multi‑Agent Collaboration**  
   - **Feed Agent** → publishes `PriceUpdate`.  
   - **Risk Agent** → sees drop, publishes `RiskAlert`.  
   - **Rebalance Agent** → on `RiskAlert` + policy approval, executes hedge.  
   - Demonstrates chained, contextual HCS‑10 messaging.

---

## 4. Recommendations

- **Start with Rebalance Flow:** Nail the core governance → agent → token service loop first.  
- **Separate HCS Topics:**  
  - `Governance.Proposals`  
  - `Market.PriceFeed`  
  - `Governance.Policies`  
  - `Agent.Actions`  
- **Maintain a Schema Registry:** Versioned JSON schemas for each message type to enforce HCS‑10 compliance.  
- **Live HCS Monitor:** Embed a real‑time message viewer in your UI to showcase HCS‑10 events to judges.  

---

By executing this plan, you’ll deliver a compelling, end‑to‑end demonstration of HCS‑10’s power for agent coordination in a tokenized index governance scenario—anchored around a vivid rebalance proposal & execution demo.  
