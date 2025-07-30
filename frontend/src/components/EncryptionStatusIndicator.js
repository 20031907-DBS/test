"use client"
import React, { useState, useEffect } from 'react';
import { Shield, Lock, LockOpen, AlertTriangle, CheckCircle, Clock, Settings, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import encryptionService from '../services/encryptionService';
import { EncryptionStatus } from '../services/encryptionService';

/**
 * EncryptionStatusIndicator - Comprehensive encryption status display
 * Shows current encryption state with detailed information and controls
 */
export default function EncryptionStatusIndicator({
    selectedUser,
    compact = false,
    showDetails = false,
    onSettingsClick,
    className = ""
}) {
    const [status, setStatus] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    // Update status periodically
    useEffect(() => {
        const updateStatus = () => {
            const currentStatus = encryptionService.getEncryptionStatus();
            setStatus(currentStatus);
        };

        updateStatus();
        const interval = setInterval(updateStatus, 2000); // Update every 2 seconds

        return () => clearInterval(interval);
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await encryptionService.refreshKeys();
            const newStatus = encryptionService.getEncryptionStatus();
            setStatus(newStatus);
        } catch (error) {
            console.error('Failed to refresh encryption:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const getStatusInfo = () => {
        if (!status) {
            return {
                icon: Clock,
                color: 'gray',
                text: 'Loading...',
                description: 'Checking encryption status'
            };
        }

        switch (status.status) {
            case EncryptionStatus.AVAILABLE:
                if (selectedUser) {
                    return {
                        icon: Lock,
                        color: 'green',
                        text: 'Encrypted',
                        description: `Messages are end-to-end encrypted for ${selectedUser.display_name || selectedUser.name || selectedUser.username}`
                    };
                } else {
                    return {
                        icon: Shield,
                        color: 'blue',
                        text: 'Ready',
                        description: 'Encryption is ready - select a user to start encrypted chat'
                    };
                }

            case EncryptionStatus.INITIALIZING:
                return {
                    icon: Clock,
                    color: 'blue',
                    text: 'Setting up...',
                    description: 'Initializing encryption keys'
                };

            case EncryptionStatus.ERROR:
                return {
                    icon: AlertTriangle,
                    color: 'red',
                    text: 'Error',
                    description: status.lastError?.userFriendlyMessage || 'Encryption error occurred'
                };

            case EncryptionStatus.UNAVAILABLE:
            default:
                return {
                    icon: LockOpen,
                    color: 'yellow',
                    text: 'Not available',
                    description: 'Encryption is not available - messages will be sent unencrypted'
                };
        }
    };

    const statusInfo = getStatusInfo();
    const IconComponent = statusInfo.icon;

    const getColorClasses = (color) => {
        const colors = {
            green: {
                bg: 'bg-green-50',
                border: 'border-green-200',
                text: 'text-green-800',
                icon: 'text-green-600',
                button: 'bg-green-100 hover:bg-green-200 text-green-800'
            },
            blue: {
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                text: 'text-blue-800',
                icon: 'text-blue-600',
                button: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
            },
            yellow: {
                bg: 'bg-yellow-50',
                border: 'border-yellow-200',
                text: 'text-yellow-800',
                icon: 'text-yellow-600',
                button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
            },
            red: {
                bg: 'bg-red-50',
                border: 'border-red-200',
                text: 'text-red-800',
                icon: 'text-red-600',
                button: 'bg-red-100 hover:bg-red-200 text-red-800'
            },
            gray: {
                bg: 'bg-gray-50',
                border: 'border-gray-200',
                text: 'text-gray-800',
                icon: 'text-gray-600',
                button: 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }
        };
        return colors[color] || colors.gray;
    };

    const colors = getColorClasses(statusInfo.color);

    if (compact) {
        return (
            <div
                className={clsx(
                    "relative inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm border",
                    colors.bg,
                    colors.border,
                    colors.text,
                    "cursor-pointer",
                    className
                )}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onClick={() => showDetails && onSettingsClick?.()}
            >
                <div className={clsx("flex-shrink-0", colors.icon)}>
                    {status?.status === EncryptionStatus.INITIALIZING ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
                    ) : (
                        <IconComponent className="w-3 h-3" />
                    )}
                </div>
                <span className="font-medium">{statusInfo.text}</span>

                {showTooltip && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10">
                        {statusInfo.description}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={clsx(
            "flex items-center justify-between px-4 py-3 rounded-lg border",
            colors.bg,
            colors.border,
            className
        )}>
            <div className="flex items-center space-x-3">
                <div className={clsx("flex-shrink-0", colors.icon)}>
                    {status?.status === EncryptionStatus.INITIALIZING ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                    ) : (
                        <IconComponent className="w-5 h-5" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className={clsx("text-sm font-medium", colors.text)}>
                        {statusInfo.text}
                    </div>
                    <div className={clsx("text-xs opacity-75", colors.text)}>
                        {statusInfo.description}
                    </div>

                    {/* Additional status details */}
                    {showDetails && status && (
                        <div className={clsx("mt-2 text-xs space-y-1", colors.text)}>
                            {status.keysInitialized && (
                                <div className="flex items-center space-x-1">
                                    <CheckCircle className="w-3 h-3" />
                                    <span>Keys initialized</span>
                                </div>
                            )}

                            {status.keyGenerationTime && (
                                <div className="opacity-75">
                                    Keys generated: {new Date(status.keyGenerationTime).toLocaleString()}
                                </div>
                            )}

                            {status.userId && (
                                <div className="opacity-75">
                                    User ID: {status.userId}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-2">
                {status?.status === EncryptionStatus.ERROR && (
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className={clsx(
                            "p-1.5 rounded-md text-xs font-medium transition-colors",
                            colors.button,
                            isRefreshing && "opacity-50 cursor-not-allowed"
                        )}
                        title="Retry encryption setup"
                    >
                        <RefreshCw className={clsx("w-3 h-3", isRefreshing && "animate-spin")} />
                    </button>
                )}

                {onSettingsClick && (
                    <button
                        onClick={onSettingsClick}
                        className={clsx(
                            "p-1.5 rounded-md text-xs font-medium transition-colors",
                            colors.button
                        )}
                        title="Encryption settings"
                    >
                        <Settings className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * EncryptionStatusBadge - Simple badge version for minimal space
 */
export function EncryptionStatusBadge({ selectedUser, className = "" }) {
    return (
        <EncryptionStatusIndicator
            selectedUser={selectedUser}
            compact={true}
            className={className}
        />
    );
}

/**
 * EncryptionStatusPanel - Detailed panel version with full information
 */
export function EncryptionStatusPanel({ selectedUser, onSettingsClick, className = "" }) {
    return (
        <EncryptionStatusIndicator
            selectedUser={selectedUser}
            compact={false}
            showDetails={true}
            onSettingsClick={onSettingsClick}
            className={className}
        />
    );
}