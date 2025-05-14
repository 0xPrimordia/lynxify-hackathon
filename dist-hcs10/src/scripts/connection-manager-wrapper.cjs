"use strict";
/**
 * ConnectionsManager CommonJS Wrapper
 *
 * This is a CommonJS wrapper for ConnectionsManager to solve the
 * compatibility issues between ES Modules and CommonJS.
 *
 * It provides functions to import the ConnectionsManager from the
 * ES Module wrapper and use it in CommonJS files.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const path = require('path');
/**
 * Get the ConnectionsManager class from the ES Module wrapper
 * @returns {Promise<any>} The ConnectionsManager class
 */
async function getConnectionsManager() {
    try {
        // Dynamically import the ESM wrapper
        const wrapper = await Promise.resolve().then(() => __importStar(require('./connections-manager-esm-wrapper.mjs')));
        return wrapper.default;
    }
    catch (error) {
        console.error('Error importing ConnectionsManager:', error.message);
        throw new Error('Failed to import ConnectionsManager: ' + error.message);
    }
}
/**
 * Create a new ConnectionsManager instance
 * @param {Object} options The options to pass to the ConnectionsManager constructor
 * @returns {Promise<any>} A new ConnectionsManager instance
 */
async function createConnectionsManager(options) {
    const CM = await getConnectionsManager();
    return new CM(options);
}
module.exports = {
    getConnectionsManager,
    createConnectionsManager
};
