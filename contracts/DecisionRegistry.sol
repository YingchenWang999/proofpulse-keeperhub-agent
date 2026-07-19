// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal, non-payable registry for agent decisions. It never holds or moves assets.
contract DecisionRegistry {
    struct Decision {
        address recorder;
        uint64 recordedAt;
        uint8 status;
        uint16 confidenceBps;
        bytes32 evidenceHash;
        string summary;
    }

    // Scope run IDs by recorder so another account cannot front-run and consume
    // an agent's deterministic ID before its KeeperHub transaction lands.
    mapping(address recorder => mapping(bytes32 runId => Decision)) public decisions;

    event DecisionRecorded(
        bytes32 indexed runId,
        address indexed recorder,
        uint8 status,
        uint16 confidenceBps,
        bytes32 indexed evidenceHash,
        string summary
    );

    error DuplicateRunId(bytes32 runId);
    error InvalidStatus(uint8 status);
    error InvalidConfidence(uint16 confidenceBps);
    error InvalidSummaryLength(uint256 length);

    function recordDecision(
        bytes32 runId,
        uint8 status,
        uint16 confidenceBps,
        bytes32 evidenceHash,
        string calldata summary
    ) external {
        if (decisions[msg.sender][runId].recorder != address(0)) revert DuplicateRunId(runId);
        if (status < 1 || status > 3) revert InvalidStatus(status);
        if (confidenceBps > 10_000) revert InvalidConfidence(confidenceBps);
        uint256 summaryLength = bytes(summary).length;
        if (summaryLength == 0 || summaryLength > 240) revert InvalidSummaryLength(summaryLength);

        decisions[msg.sender][runId] = Decision({
            recorder: msg.sender,
            recordedAt: uint64(block.timestamp),
            status: status,
            confidenceBps: confidenceBps,
            evidenceHash: evidenceHash,
            summary: summary
        });

        emit DecisionRecorded(runId, msg.sender, status, confidenceBps, evidenceHash, summary);
    }
}
