import React from 'react';
import { GamePhase } from '../types';
import { MAX_BET, MIN_BET } from '../constants';

interface ControlsProps {
    phase: GamePhase;
    credits: number;
    betAmount: number;
    currentWin: number;
    onDeal: () => void;
    onDraw: () => void;
    onBetChange: (direction: 'up' | 'down' | 'max') => void;
    onCashOut: () => void;
    onGamble: () => void;
    dealAgainText: string;
}

const ActionButton: React.FC<React.PropsWithChildren<{ onClick: () => void; disabled?: boolean; variant?: 'primary' | 'secondary'; className?: string }>> = ({ onClick, disabled, variant = 'secondary', children, className }) => {
    const baseClasses = "font-semibold py-3 px-6 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-brand-yellow/30 w-full";
    
    const variantClasses = {
        primary: "bg-brand-yellow text-brand-dark-bg hover:opacity-90",
        secondary: "bg-brand-panel-bg text-white hover:bg-brand-panel-light"
    };
    
    const disabledClasses = "disabled:bg-brand-panel-bg/50 disabled:cursor-not-allowed disabled:text-slate-500";
    
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${disabledClasses} ${className}`}
        >
            {children}
        </button>
    );
};

const Controls: React.FC<ControlsProps> = ({ phase, credits, betAmount, currentWin, onDeal, onDraw, onBetChange, onCashOut, onGamble, dealAgainText }) => {
    const maxPossibleBet = Math.min(MAX_BET, credits);

    const renderActionButtons = () => {
        switch (phase) {
            case GamePhase.Betting:
                return <ActionButton variant="primary" onClick={onDeal} disabled={credits < betAmount}>DEAL</ActionButton>;
            
            case GamePhase.Dealt:
                return <ActionButton variant="primary" onClick={onDraw}>DRAW</ActionButton>;

            case GamePhase.Drawn:
                if (currentWin > 0) {
                    return (
                        <div className="w-full grid grid-cols-2 gap-2 sm:gap-3">
                            <ActionButton onClick={onCashOut}>CASH OUT</ActionButton>
                            <ActionButton variant="primary" onClick={onGamble}>DOUBLE</ActionButton>
                        </div>
                    );
                }
                return <ActionButton variant="primary" onClick={onDeal} disabled={credits < betAmount}>{dealAgainText}</ActionButton>;
            
            default:
                return null;
        }
    };

    return (
        <div className="w-full grid grid-cols-2 gap-2 sm:gap-3 h-20 items-center px-2">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <ActionButton onClick={() => onBetChange('down')} disabled={betAmount <= MIN_BET}>-</ActionButton>
                <ActionButton onClick={() => onBetChange('up')} disabled={betAmount >= maxPossibleBet}>+</ActionButton>
                <ActionButton onClick={() => onBetChange('max')} disabled={betAmount === maxPossibleBet}>
                    <span className="relative right-1">MAX</span>
                </ActionButton>
            </div>
            
            <div className="col-span-1">
                {renderActionButtons()}
            </div>
        </div>
    );
};

export default Controls;