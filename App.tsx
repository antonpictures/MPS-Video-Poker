import React, { useState, useEffect, useCallback } from 'react';
import { GamePhase, Card as CardType, GambleHistoryItem } from './types';
import { PAY_TABLE, MAX_BET, MIN_BET, STARTING_CREDITS, MAX_GAMBLE_ATTEMPTS, ANTI_GAMBLING_MESSAGES, DEAL_AGAIN_MESSAGES } from './constants';
import { createDeck, evaluateHand, getWinningCards, autoHoldStrategy } from './services/gameLogic';
import PayTable from './components/PayTable';
import Card from './components/Card';
import GameInfo from './components/GameInfo';
import Controls from './components/Controls';
import Modal from './components/Modal';
import GambleView from './components/GambleView';
import HistoryLog from './components/HistoryLog';

const App: React.FC = () => {
    const [credits, setCredits] = useState<number>(STARTING_CREDITS);
    const [betAmount, setBetAmount] = useState<number>(250);
    const [currentWin, setCurrentWin] = useState<number>(0);
    const [hand, setHand] = useState<CardType[]>([]);
    const [heldCards, setHeldCards] = useState<boolean[]>([false, false, false, false, false]);
    const [winningCards, setWinningCards] = useState<boolean[]>([false, false, false, false, false]);
    const [phase, setPhase] = useState<GamePhase>(GamePhase.Betting);
    const [handResult, setHandResult] = useState<string>('');
    const [deck, setDeck] = useState<CardType[]>([]);
    const [showOutOfCreditsModal, setShowOutOfCreditsModal] = useState<boolean>(false);
    const [gambleAttempts, setGambleAttempts] = useState<number>(0);
    const [losingMessage, setLosingMessage] = useState<string>('');
    const [dealAgainText, setDealAgainText] = useState<string>('DEAL AGAIN');
    const [lastWin, setLastWin] = useState<{amount: number; result: string}>({amount: 0, result: ''});
    const [history, setHistory] = useState<GambleHistoryItem[]>([]);
    const [isPanelVisible, setIsPanelVisible] = useState(true);


    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem('mpsPokerGambleHistory');
            if (savedHistory) {
                setHistory(JSON.parse(savedHistory));
            }
        } catch (error) {
            console.error("Could not load gamble history:", error);
        }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('mpsPokerGambleHistory', JSON.stringify(history));
        } catch (error) {
            console.error("Could not save gamble history:", error);
        }
    }, [history]);

    const transitionToPhase = useCallback((nextPhase: GamePhase, callback?: () => void) => {
        setIsPanelVisible(false);
        setTimeout(() => {
            setPhase(nextPhase);
            if (callback) callback();
            setIsPanelVisible(true);
        }, 250);
    }, []);

    const resetHand = useCallback(() => {
        setHand([]);
        setHeldCards([false, false, false, false, false]);
        setWinningCards([false, false, false, false, false]);
        setCurrentWin(0);
        setHandResult('');
        setLastWin({amount: 0, result: ''});
        setLosingMessage('');
        setGambleAttempts(0);
        setPhase(GamePhase.Betting);
        setDealAgainText('DEAL AGAIN');
    }, []);

    const handleDeal = useCallback(() => {
        if (credits < betAmount) {
            setShowOutOfCreditsModal(true);
            return;
        }

        setCredits(prev => prev - betAmount);
        const newDeck = createDeck();
        const newHand = newDeck.slice(0, 5);
        setHand(newHand);
        setDeck(newDeck.slice(5));
        setPhase(GamePhase.Dealt);
        setHandResult('');
        setLastWin({amount: 0, result: ''});
        setLosingMessage('');
        setCurrentWin(0);
        setWinningCards([false, false, false, false, false]);
        setHeldCards(autoHoldStrategy(newHand));
    }, [credits, betAmount]);

    const handleDraw = useCallback(() => {
        let deckIndex = 0;
        const finalHand = hand.map((card, i) => {
            if (!heldCards[i]) {
                return deck[deckIndex++];
            }
            return card;
        });

        setHand(finalHand);
        const result = evaluateHand(finalHand);
        setHandResult(result);

        const payout = PAY_TABLE[result] || 0;
        const winAmount = payout * betAmount;
        
        if (winAmount > 0) {
            setCurrentWin(winAmount);
            setWinningCards(getWinningCards(finalHand, result));
            setLosingMessage('');
            setLastWin({ amount: winAmount, result });
        } else {
            setLastWin({ amount: 0, result: 'NO WIN' });
        }
        
        setPhase(GamePhase.Drawn);
    }, [hand, heldCards, deck, betAmount]);
    
    const handleCashOut = useCallback(() => {
        if (phase === GamePhase.Gamble) {
            transitionToPhase(GamePhase.Betting, () => {
                const newHistoryItem: GambleHistoryItem = {
                    id: Date.now().toString(),
                    outcome: 'cashed_out',
                    amount: currentWin,
                    streak: gambleAttempts,
                    timestamp: Date.now(),
                };
                setHistory(prev => [newHistoryItem, ...prev]);
                setCredits(prev => prev + currentWin);
                setCurrentWin(0);
                setGambleAttempts(0);
            });
        } else {
            setCredits(prev => prev + currentWin);
            setCurrentWin(0);
            setPhase(GamePhase.Betting);
            setGambleAttempts(0);
        }
    }, [currentWin, phase, gambleAttempts, history, transitionToPhase]);

    const handleToggleHold = (index: number) => {
        if (phase === GamePhase.Dealt) {
            setHeldCards(prev => {
                const newHeld = [...prev];
                newHeld[index] = !newHeld[index];
                return newHeld;
            });
        }
    };

    const handleBetChange = (direction: 'up' | 'down' | 'max') => {
        if (direction === 'max') {
            setBetAmount(Math.min(MAX_BET, credits));
        } else if (direction === 'up') {
            setBetAmount(prev => Math.min(MAX_BET, prev * 2 > credits ? credits : prev * 2));
        } else {
            setBetAmount(prev => Math.max(MIN_BET, Math.floor(prev / 2)));
        }
    };
    
    const handleGambleResult = useCallback((isWin: boolean, card: CardType) => {
        if (isWin) {
            const newAttempts = gambleAttempts + 1;
            setGambleAttempts(newAttempts);
            setCurrentWin(prevWin => {
                const newWin = prevWin * 2;
                if (newAttempts >= MAX_GAMBLE_ATTEMPTS) {
                    setTimeout(() => {
                         transitionToPhase(GamePhase.Betting, () => {
                            const newHistoryItem: GambleHistoryItem = {
                                id: Date.now().toString(),
                                outcome: 'cashed_out',
                                amount: newWin,
                                streak: newAttempts,
                                timestamp: Date.now(),
                                finalCard: card,
                            };
                            setHistory(prev => [newHistoryItem, ...prev]);
                            setCredits(prevCredits => prevCredits + newWin);
                            setCurrentWin(0);
                            setGambleAttempts(0);
                         });
                    }, 1500);
                }
                return newWin;
            });
        } else {
            transitionToPhase(GamePhase.Drawn, () => {
                const newHistoryItem: GambleHistoryItem = {
                    id: Date.now().toString(),
                    outcome: 'lost',
                    amount: currentWin,
                    streak: gambleAttempts + 1,
                    timestamp: Date.now(),
                    finalCard: card,
                };
                setHistory(prev => [newHistoryItem, ...prev]);
                setCurrentWin(0);
                const randomMsg = ANTI_GAMBLING_MESSAGES[Math.floor(Math.random() * ANTI_GAMBLING_MESSAGES.length)];
                setLosingMessage(randomMsg);
                const randomBtnText = DEAL_AGAIN_MESSAGES[Math.floor(Math.random() * DEAL_AGAIN_MESSAGES.length)];
                setDealAgainText(randomBtnText);
            });
        }
    }, [gambleAttempts, currentWin, transitionToPhase]);

    const reloadCredits = () => {
        setCredits(STARTING_CREDITS);
        setShowOutOfCreditsModal(false);
        resetHand();
    };

    useEffect(() => {
        if (phase === GamePhase.Drawn && currentWin === 0) {
            const timeoutId = setTimeout(() => {
                if (credits >= betAmount) {
                    handleDeal();
                } else {
                    if (credits === 0) {
                        setShowOutOfCreditsModal(true);
                    }
                    resetHand();
                }
            }, 3000);
            return () => clearTimeout(timeoutId);
        }
    }, [phase, currentWin, credits, betAmount, handleDeal, resetHand]);


    return (
        <div className="min-h-screen text-white flex flex-col items-center p-2 sm:p-4 selection:bg-brand-yellow selection:text-black">
            <main className="w-full max-w-md mx-auto flex flex-col items-center">
                <header className="w-full flex justify-between items-center my-2 px-1">
                    <h1 className="text-xl font-bold text-slate-300 tracking-wider">$MPS</h1>
                    <GameInfo credits={credits} betAmount={betAmount} currentWin={currentWin} />
                </header>

                <div className={`w-full min-h-[18rem] my-2 flex items-center justify-center transition-opacity duration-200 ease-in-out ${isPanelVisible ? 'opacity-100' : 'opacity-0'}`}>
                     {phase === GamePhase.Gamble ? (
                        <GambleView 
                            currentWin={currentWin}
                            onGambleResult={handleGambleResult}
                            onCashOut={handleCashOut}
                        />
                     ) : (
                        <PayTable betAmount={betAmount} handResult={handResult} />
                     )}
                </div>
                
                <div className="w-full h-8 flex items-center justify-center">
                    {lastWin.amount > 0 && phase !== GamePhase.Betting && (
                         <div key={lastWin.result} className="bg-brand-green text-white text-sm font-bold px-4 py-1.5 rounded-full shadow-lg animate-pop-in">
                            {lastWin.result}
                        </div>
                    )}
                    {currentWin === 0 && losingMessage && (
                        <div className="bg-black/50 border border-brand-red/50 px-4 py-2 rounded-xl animate-pop-in">
                            <p className="text-base text-yellow-300 text-center">
                                {losingMessage}
                            </p>
                        </div>
                    )}
                </div>

                <div className="w-full min-h-[13rem] flex items-center justify-center">
                    {hand.length === 5 ? (
                         <div className="flex justify-center space-x-1 sm:space-x-2">
                            {hand.map((card, i) => (
                                <Card
                                    key={`${card.suit}-${card.value}-${i}`}
                                    card={card}
                                    isHeld={heldCards[i]}
                                    isWinning={winningCards[i]}
                                    isDealtPhase={phase === GamePhase.Dealt}
                                    onClick={() => handleToggleHold(i)}
                                    animationDelay={i * 80}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-2xl font-medium text-slate-500">RISK YOUR $MPS</p>
                        </div>
                    )}
                </div>
                
                <Controls 
                    phase={phase}
                    credits={credits}
                    betAmount={betAmount}
                    currentWin={currentWin}
                    onDeal={handleDeal}
                    onDraw={handleDraw}
                    onBetChange={handleBetChange}
                    onCashOut={handleCashOut}
                    onGamble={() => transitionToPhase(GamePhase.Gamble)}
                    dealAgainText={dealAgainText}
                />
                
                <HistoryLog history={history} />
            </main>
            
            <Modal
                isOpen={showOutOfCreditsModal}
                onClose={() => {}}
                title="It's Time To Stop."
            >
                <div className="text-center">
                    <p className="text-lg text-slate-300">You've run out of credits. This feeling of loss is what addiction feeds on.</p>
                    <p className="mb-6 text-slate-300">In the real world, there are no restarts. If gambling is a problem, seek help.</p>
                    <button 
                        onClick={reloadCredits}
                        className="w-full bg-brand-yellow text-brand-dark-bg font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity duration-200"
                    >
                        Restart Simulation
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default App;