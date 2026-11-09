import { useState, useEffect, useCallback } from 'react';
import { GameState, Bill, Faction } from './types';
import { initialFactions, allBills, totalSeats } from './gameData';

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRandomBill(usedIds: string[]): Bill | null {
  const available = allBills.filter(b => !usedIds.includes(b.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

function App() {
  const [gameState, setGameState] = useState<GameState>({
    round: 1,
    popularity: 50,
    budget: 200,
    factions: initialFactions.map(f => ({ ...f })),
    currentBill: null,
    passedBills: [],
    rejectedBills: [],
    gameOver: false,
    message: 'Добро пожаловать в Парламент! Вы — лидер центристской партии. Голосуйте мудро!',
  });

  const [showResult, setShowResult] = useState(false);
  const [voteResult, setVoteResult] = useState<{ passed: boolean; forVotes: number; againstVotes: number } | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [animatingVote, setAnimatingVote] = useState(false);

  const startNewRound = useCallback(() => {
    const usedIds = [...gameState.passedBills, ...gameState.rejectedBills];
    const bill = getRandomBill(usedIds);
    if (!bill) {
      setGameState(prev => ({
        ...prev,
        gameOver: true,
        message: 'Все законопроекты рассмотрены! Игра окончена.',
      }));
      return;
    }
    setGameState(prev => ({
      ...prev,
      currentBill: bill,
      message: `Раунд ${prev.round}: Новый законопроект на рассмотрении`,
    }));
    setShowResult(false);
    setVoteResult(null);
  }, [gameState.passedBills, gameState.rejectedBills]);

  useEffect(() => {
    if (gameStarted && !gameState.currentBill && !gameState.gameOver) {
      startNewRound();
    }
  }, [gameStarted, gameState.currentBill, gameState.gameOver, startNewRound]);

  const calculateVotes = (bill: Bill, playerVote: 'for' | 'against'): { forVotes: number; againstVotes: number } => {
    let forVotes = 0;
    let againstVotes = 0;

    gameState.factions.forEach(faction => {
      let support = 50; // base support

      if (faction.id === 'player') {
        support = playerVote === 'for' ? 95 : 5;
      } else {
        const effect = bill.effects.factionEffects.find(e => e.factionId === faction.id);
        if (effect) {
          support = 50 + effect.moodChange + (faction.mood - 50) * 0.3;
        }
        // Add some randomness
        support += (Math.random() - 0.5) * 20;
      }

      support = Math.max(0, Math.min(100, support));
      const factionVotes = Math.round(faction.seats * support / 100);
      forVotes += factionVotes;
      againstVotes += faction.seats - factionVotes;
    });

    return { forVotes, againstVotes };
  };

  const handleVote = (vote: 'for' | 'against') => {
    if (!gameState.currentBill || animatingVote) return;

    setAnimatingVote(true);

    setTimeout(() => {
      const bill = gameState.currentBill!;
      const { forVotes, againstVotes } = calculateVotes(bill, vote);
      const passed = forVotes > totalSeats / 2;

      setVoteResult({ passed, forVotes, againstVotes });
      setShowResult(true);

      // Update factions mood
      const newFactions = gameState.factions.map(faction => {
        let moodChange = 0;
        if (faction.id === 'player') {
          moodChange = passed ? 5 : -3;
        } else {
          const effect = bill.effects.factionEffects.find(e => e.factionId === faction.id);
          if (effect) {
            moodChange = passed ? Math.round(effect.moodChange * 0.5) : Math.round(-effect.moodChange * 0.3);
          }
        }
        return {
          ...faction,
          mood: Math.max(0, Math.min(100, faction.mood + moodChange)),
        };
      });

      setGameState(prev => ({
        ...prev,
        popularity: Math.max(0, Math.min(100, prev.popularity + (passed ? bill.effects.popularity : -Math.abs(bill.effects.popularity) * 0.3))),
        budget: prev.budget + (passed ? bill.effects.budget : 0),
        factions: newFactions,
        passedBills: passed ? [...prev.passedBills, bill.id] : prev.passedBills,
        rejectedBills: passed ? prev.rejectedBills : [...prev.rejectedBills, bill.id],
        round: prev.round + 1,
        message: passed
          ? `✅ Закон "${bill.title}" принят! (${forVotes} за / ${againstVotes} против)`
          : `❌ Закон "${bill.title}" отклонён! (${forVotes} за / ${againstVotes} против)`,
        gameOver: prev.popularity + (passed ? bill.effects.popularity : 0) <= 0 || prev.budget + (passed ? bill.effects.budget : 0) < -100,
      }));

      setAnimatingVote(false);
    }, 1000);
  };

  const nextRound = () => {
    if (gameState.gameOver) return;
    setGameState(prev => ({ ...prev, currentBill: null }));
  };

  const restartGame = () => {
    setGameState({
      round: 1,
      popularity: 50,
      budget: 200,
      factions: initialFactions.map(f => ({ ...f })),
      currentBill: null,
      passedBills: [],
      rejectedBills: [],
      gameOver: false,
      message: 'Добро пожаловать в Парламент! Вы — лидер центристской партии. Голосуйте мудро!',
    });
    setShowResult(false);
    setVoteResult(null);
    setGameStarted(true);
  };

  const getMoodEmoji = (mood: number) => {
    if (mood >= 75) return '😊';
    if (mood >= 50) return '😐';
    if (mood >= 25) return '😟';
    return '😡';
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      economy: '📊 Экономика',
      social: '👥 Социальная сфера',
      security: '🔒 Безопасность',
      education: '📚 Образование',
      environment: '🌍 Экология',
    };
    return labels[category] || category;
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-8 max-w-lg w-full text-center border border-slate-700 shadow-2xl">
          <div className="text-6xl mb-4">🏛️</div>
          <h1 className="text-4xl font-bold text-white mb-4">Симулятор Парламента</h1>
          <p className="text-slate-300 mb-6 text-lg">
            Вы — лидер центристской партии в парламенте из 310 депутатов.
            Голосуйте за законопроекты, балансируйте между фракциями
            и сохраняйте популярность!
          </p>
          <div className="bg-slate-700/50 rounded-xl p-4 mb-6 text-left">
            <h3 className="text-white font-semibold mb-2">📋 Правила:</h3>
            <ul className="text-slate-300 text-sm space-y-1">
              <li>• Каждый раунд вам предлагают новый законопроект</li>
              <li>• Голосуйте «За» или «Против»</li>
              <li>• Закон принимается, если «За» больше половины</li>
              <li>• Следите за популярностью и бюджетом</li>
              <li>• Если популярность упадёт до 0 — вы проиграли!</li>
            </ul>
          </div>
          <button
            onClick={() => setGameStarted(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg"
          >
            🎮 Начать игру
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏛️</span>
            <h1 className="text-2xl font-bold text-white">Парламент</h1>
            <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-sm">
              Раунд {gameState.round}
            </span>
          </div>
          <div className="flex gap-4">
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-700">
              <span className="text-slate-400 text-sm">Популярность</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-500"
                    style={{ width: `${gameState.popularity}%` }}
                  />
                </div>
                <span className="text-white font-bold">{gameState.popularity}%</span>
              </div>
            </div>
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-slate-700">
              <span className="text-slate-400 text-sm">Бюджет</span>
              <div className="text-white font-bold">
                💰 {gameState.budget} млрд
              </div>
            </div>
          </div>
        </header>

        {/* Message */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl p-4 mb-6 border border-slate-700">
          <p className="text-slate-200 text-center">{gameState.message}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel - Factions */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>👥</span> Фракции
                <span className="text-sm text-slate-400 font-normal">({totalSeats} мест)</span>
              </h2>
              <div className="space-y-3">
                {gameState.factions.map(faction => (
                  <div key={faction.id} className="bg-slate-700/50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: faction.color }}
                        />
                        <span className="text-white text-sm font-medium">{faction.name}</span>
                      </div>
                      <span className="text-slate-400 text-xs">{faction.seats} мест</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${faction.mood}%`,
                            backgroundColor: faction.mood > 60 ? '#10B981' : faction.mood > 30 ? '#F59E0B' : '#EF4444',
                          }}
                        />
                      </div>
                      <span className="text-xs">{getMoodEmoji(faction.mood)}</span>
                    </div>
                    <div className="text-slate-500 text-xs mt-1">{faction.ideology}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center panel - Current Bill */}
          <div className="lg:col-span-2">
            {gameState.gameOver ? (
              <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 text-center">
                <div className="text-6xl mb-4">
                  {gameState.popularity <= 0 ? '😞' : '🎉'}
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  {gameState.popularity <= 0 ? 'Вы потеряли поддержку народа!' : 'Каденция завершена!'}
                </h2>
                <div className="grid grid-cols-2 gap-4 mb-6 max-w-sm mx-auto">
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-green-400">{gameState.passedBills.length}</div>
                    <div className="text-slate-400 text-sm">Законов принято</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-red-400">{gameState.rejectedBills.length}</div>
                    <div className="text-slate-400 text-sm">Законов отклонено</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-blue-400">{gameState.round - 1}</div>
                    <div className="text-slate-400 text-sm">Раундов</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-yellow-400">{gameState.budget}</div>
                    <div className="text-slate-400 text-sm">Бюджет</div>
                  </div>
                </div>
                <button
                  onClick={restartGame}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-lg transition-all transform hover:scale-105"
                >
                  🔄 Играть снова
                </button>
              </div>
            ) : gameState.currentBill ? (
              <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-sm">
                    {getCategoryLabel(gameState.currentBill.category)}
                  </span>
                  <span className="text-4xl">{gameState.currentBill.icon}</span>
                </div>

                <h2 className="text-2xl font-bold text-white mb-3">{gameState.currentBill.title}</h2>
                <p className="text-slate-300 mb-6">{gameState.currentBill.description}</p>

                {/* Effects preview */}
                <div className="bg-slate-700/30 rounded-xl p-4 mb-6">
                  <h3 className="text-sm font-semibold text-slate-400 mb-2">Последствия:</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span>📈 Популярность:</span>
                      <span className={gameState.currentBill.effects.popularity >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {gameState.currentBill.effects.popularity > 0 ? '+' : ''}{gameState.currentBill.effects.popularity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>💰 Бюджет:</span>
                      <span className={gameState.currentBill.effects.budget >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {gameState.currentBill.effects.budget > 0 ? '+' : ''}{gameState.currentBill.effects.budget} млрд
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vote result */}
                {showResult && voteResult && (
                  <div className={`rounded-xl p-4 mb-6 ${voteResult.passed ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                    <div className="text-center mb-3">
                      <span className={`text-2xl font-bold ${voteResult.passed ? 'text-green-400' : 'text-red-400'}`}>
                        {voteResult.passed ? '✅ ЗАКОН ПРИНЯТ' : '❌ ЗАКОН ОТКЛОНЁН'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-green-400">За: {voteResult.forVotes}</span>
                          <span className="text-red-400">Против: {voteResult.againstVotes}</span>
                        </div>
                        <div className="h-4 bg-slate-700 rounded-full overflow-hidden flex">
                          <div
                            className="h-full bg-green-500 transition-all duration-1000"
                            style={{ width: `${(voteResult.forVotes / totalSeats) * 100}%` }}
                          />
                          <div
                            className="h-full bg-red-500 transition-all duration-1000"
                            style={{ width: `${(voteResult.againstVotes / totalSeats) * 100}%` }}
                          />
                        </div>
                        <div className="text-center text-slate-400 text-xs mt-1">
                          Необходимо: {Math.floor(totalSeats / 2) + 1} голосов
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Voting buttons */}
                {!showResult ? (
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleVote('for')}
                      disabled={animatingVote}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                    >
                      👍 Голосовать ЗА
                    </button>
                    <button
                      onClick={() => handleVote('against')}
                      disabled={animatingVote}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
                    >
                      👎 Голосовать ПРОТИВ
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={nextRound}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg"
                  >
                    ▶️ Следующий раунд
                  </button>
                )}

                {animatingVote && (
                  <div className="text-center mt-4">
                    <div className="inline-flex items-center gap-2 text-slate-300">
                      <div className="animate-spin text-xl">🗳️</div>
                      <span>Подсчёт голосов...</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 text-center">
                <div className="animate-pulse text-4xl mb-4">⏳</div>
                <p className="text-slate-300">Загрузка законопроекта...</p>
              </div>
            )}

            {/* Parliament visualization */}
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-5 border border-slate-700 mt-6">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Распределение мест в парламенте</h3>
              <div className="flex gap-0.5 h-8 rounded-lg overflow-hidden">
                {gameState.factions.map(faction => (
                  <div
                    key={faction.id}
                    className="h-full transition-all duration-500 relative group"
                    style={{
                      width: `${(faction.seats / totalSeats) * 100}%`,
                      backgroundColor: faction.color,
                    }}
                    title={`${faction.name}: ${faction.seats} мест`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {faction.name}: {faction.seats}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2">
                {gameState.factions.map(faction => (
                  <div key={faction.id} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: faction.color }} />
                    <span className="text-slate-500 text-xs">{faction.seats}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
