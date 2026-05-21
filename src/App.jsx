import React, { useEffect, useMemo, useState } from "react";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { LANGUAGES } from "./language";
import AuthPage from "./AuthPage";
import {
  KING_DECK_CODES,
  SUITS,
  emptyDeckGame,
  createTaken,
  canPlayCard,
  canRemoveCard,
  isProtectedRemoveCard,
  getTrickWinner,
  addTrickToTaken,
  calculateRoundScores,
  sortCards,
} from "./game";

const LOCAL_KEY = "king-online-modern-user";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createPlayers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: "",
    uid: "",
    ready: false,
  }));
}

function createUsedContracts(players) {
  const used = {};
  players.forEach((player) => {
    used[player.id] = [];
  });
  return used;
}

function getSeatByUid(players, uid) {
  return players.find((player) => player.uid === uid);
}

function getNextPlayerId(players, currentId) {
  const index = players.findIndex((player) => player.id === currentId);
  return (
    players[(index + 1 + players.length) % players.length]?.id || players[0]?.id
  );
}

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLocal(data) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

function clearLocal() {
  localStorage.removeItem(LOCAL_KEY);
}

function suitName(suit, lang) {
  const found = SUITS.find((item) => item.id === suit);
  if (!found) return "";
  return lang === "ka" ? found.nameKa : found.nameEn;
}

export default function App() {
  const local = loadLocal();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [roomCode, setRoomCode] = useState(local.roomCode || "");
  const [seatId, setSeatId] = useState(local.seatId || "");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState(local.name || "");
  const [createCount, setCreateCount] = useState(3);
  const [createLang, setCreateLang] = useState(local.lang || "en");
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [message, setMessage] = useState("");
  const [scoreOpen, setScoreOpen] = useState(false);

  const lang = room?.lang || createLang;
  const language = LANGUAGES[lang] || LANGUAGES.en;
  const ui = language.ui;
  const playerCount = room?.playerCount || createCount;
  const contracts = language.contracts[playerCount] || language.contracts[3];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser?.displayName) {
        setJoinName((prev) => prev || firebaseUser.displayName);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    const unsub = onSnapshot(
      doc(db, "kingRooms", roomCode),
      (snap) => {
        if (!snap.exists()) {
          setRoom(null);
          return;
        }

        const data = { id: snap.id, ...snap.data() };
        setRoom(data);

        if (user?.uid) {
          const seat = getSeatByUid(data.players || [], user.uid);
          if (seat) {
            setSeatId(seat.id);
            saveLocal({
              roomCode,
              seatId: seat.id,
              name: seat.name,
              lang: data.lang || "en",
            });
          }
        }
      },
      (error) => setPageError(error.message),
    );

    return () => unsub();
  }, [roomCode, user?.uid]);

  const players = useMemo(() => {
    const list = room?.players || createPlayers(playerCount);
    return list.map((player, index) => ({
      ...player,
      name: player.name || `${ui.player} ${index + 1}`,
    }));
  }, [room?.players, playerCount, ui.player]);

  const me = players.find((player) => player.id === seatId);
  const isHost = seatId === "p1";
  const gameStatus = room?.status || "lobby";
  const chooser = players[room?.chooserIndex || 0] || players[0];
  const currentContract =
    contracts.find((contract) => contract.id === room?.selectedContractId) ||
    null;

  const usedContracts = room?.usedContracts || createUsedContracts(players);
  const deckGame = room?.deckGame || emptyDeckGame;
  const history = room?.history || [];
  const currentTurnId = deckGame.currentTurnId || "";
  const myHand = deckGame.hands?.[seatId] || [];
  const tableCards = deckGame.tableCards || [];
  const roundOver = deckGame.roundOver || false;
  const totalRounds = contracts.length * players.length;
  const gameFinished = history.length >= totalRounds;

  const totals = useMemo(() => {
    const result = {};
    players.forEach((player) => {
      result[player.id] = 0;
    });

    history.forEach((round) => {
      players.forEach((player) => {
        result[player.id] += round.scores?.[player.id] || 0;
      });
    });

    return result;
  }, [players, history]);

  const chooserProgress = useMemo(() => {
    const result = {};
    players.forEach((player) => {
      result[player.id] = usedContracts[player.id]?.length || 0;
    });
    return result;
  }, [players, usedContracts]);

  async function patchRoom(data) {
    if (!roomCode) return;

    await updateDoc(doc(db, "kingRooms", roomCode), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  function addExtraCardsToChooser(baseDeck = deckGame) {
    if (playerCount !== 3) return baseDeck;
    if ((baseDeck.pendingExtraCards || []).length !== 2) return baseDeck;

    const chooserHand = baseDeck.hands?.[chooser.id] || [];

    return {
      ...baseDeck,
      hands: {
        ...baseDeck.hands,
        [chooser.id]: sortCards([
          ...chooserHand,
          ...baseDeck.pendingExtraCards,
        ]),
      },
      pendingExtraCards: [],
    };
  }

  async function createRoom() {
    setPageError("");
    setLoading(true);

    try {
      const name = joinName.trim() || user.displayName || user.email;
      const code = makeRoomCode();
      const playersList = createPlayers(createCount);

      playersList[0] = {
        ...playersList[0],
        name,
        uid: user.uid,
        ready: true,
      };

      await setDoc(doc(db, "kingRooms", code), {
        lang: createLang,
        playerCount: createCount,
        players: playersList,
        status: "lobby",
        chooserIndex: 0,
        selectedContractId: "",
        usedContracts: createUsedContracts(playersList),
        history: [],
        deckGame: emptyDeckGame,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setRoomCode(code);
      setSeatId("p1");
      saveLocal({ roomCode: code, seatId: "p1", name, lang: createLang });
    } catch (error) {
      setPageError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    setPageError("");
    setLoading(true);

    try {
      const code = joinCode.trim().toUpperCase();
      const name = joinName.trim() || user.displayName || user.email;

      if (!code) return;

      const ref = doc(db, "kingRooms", code);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setPageError(ui.errors.roomNotFound);
        return;
      }

      const data = snap.data();
      const playersList = data.players || [];

      let seatIndex = playersList.findIndex(
        (player) => player.uid === user.uid,
      );
      if (seatIndex === -1) {
        seatIndex = playersList.findIndex((player) => !player.uid);
      }

      if (seatIndex === -1) {
        setPageError(ui.errors.roomFull);
        return;
      }

      const nextPlayers = [...playersList];
      nextPlayers[seatIndex] = {
        ...nextPlayers[seatIndex],
        name,
        uid: user.uid,
        ready: false,
      };

      await updateDoc(ref, {
        players: nextPlayers,
        updatedAt: serverTimestamp(),
      });

      setRoomCode(code);
      setSeatId(nextPlayers[seatIndex].id);
      saveLocal({
        roomCode: code,
        seatId: nextPlayers[seatIndex].id,
        name,
        lang: data.lang || "en",
      });
    } catch (error) {
      setPageError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleReady() {
    await patchRoom({
      players: players.map((player) => {
        if (player.id !== seatId) return player;
        return { ...player, ready: !player.ready };
      }),
    });
  }

  async function startGame() {
    if (!players.every((player) => player.uid)) {
      setPageError(ui.waitingPlayers);
      return;
    }

    await patchRoom({
      status: "playing",
      selectedContractId: "",
      deckGame: emptyDeckGame,
    });
  }

  async function changeLanguage(nextLang) {
    setCreateLang(nextLang);
    if (roomCode) await patchRoom({ lang: nextLang });
  }

  async function dealCards() {
    setPageError("");

    if (seatId !== chooser.id) return;

    await patchRoom({
      selectedContractId: "",
      deckGame: { ...emptyDeckGame, loading: true },
    });

    try {
      const cardsQuery = KING_DECK_CODES.join(",");
      const shuffleResponse = await fetch(
        `https://deckofcardsapi.com/api/deck/new/shuffle/?cards=${cardsQuery}`,
      );
      const shuffleData = await shuffleResponse.json();

      if (!shuffleData.success) throw new Error("Could not shuffle deck.");

      const drawResponse = await fetch(
        `https://deckofcardsapi.com/api/deck/${shuffleData.deck_id}/draw/?count=32`,
      );
      const drawData = await drawResponse.json();

      if (!drawData.success) throw new Error("Could not draw cards.");

      const hands = {};
      let cardIndex = 0;

      players.forEach((player) => {
        const give = playerCount === 3 ? 10 : 8;
        hands[player.id] = sortCards(
          drawData.cards.slice(cardIndex, cardIndex + give),
        );
        cardIndex += give;
      });

      await patchRoom({
        selectedContractId: "",
        deckGame: {
          ...emptyDeckGame,
          deckId: shuffleData.deck_id,
          hands,
          pendingExtraCards:
            playerCount === 3
              ? drawData.cards.slice(cardIndex, cardIndex + 2)
              : [],
          maxTricks: playerCount === 3 ? 10 : 8,
          taken: createTaken(players),
          loading: false,
        },
      });
    } catch (error) {
      await patchRoom({
        deckGame: { ...emptyDeckGame, loading: false, error: error.message },
      });
    }
  }

  async function chooseContract(contract) {
    if (seatId !== chooser.id) return;
    if (!deckGame.deckId) return;
    if (deckGame.modeLocked) return;
    if ((usedContracts[chooser.id] || []).includes(contract.id)) return;

    await patchRoom({
      selectedContractId: contract.id,
      deckGame: {
        ...deckGame,
        trumpSuit: "",
        trumpLocked: false,
        modeLocked: false,
        error: "",
      },
    });
  }

  async function confirmMode() {
    if (seatId !== chooser.id) return;
    if (!currentContract) {
      setPageError(ui.selectModeFirst);
      return;
    }
    if (!deckGame.deckId) return;
    if (deckGame.modeLocked) return;

    if (currentContract.id === "tricks-positive" && !deckGame.trumpSuit) {
      setPageError(
        lang === "ka" ? "აირჩიე მთავარი ფერი." : "Choose main suit.",
      );
      return;
    }

    const withExtra = addExtraCardsToChooser(deckGame);

    await patchRoom({
      deckGame: {
        ...withExtra,
        trumpLocked: currentContract.id === "tricks-positive",
        modeLocked: true,
        currentTurnId: playerCount === 3 ? "" : chooser.id,
        error: "",
      },
    });
  }

  async function chooseTrumpSuit(suit) {
    if (seatId !== chooser.id) return;
    if (!currentContract || currentContract.id !== "tricks-positive") return;
    if (deckGame.trumpLocked || deckGame.modeLocked) return;
    if (!deckGame.deckId) return;

    await patchRoom({
      deckGame: {
        ...deckGame,
        trumpSuit: suit,
        error: "",
      },
    });
  }

  async function toggleRemoveCard(code) {
    if (playerCount !== 3) return;
    if (seatId !== chooser.id) return;
    if (!currentContract) return;

    const chooserHand = deckGame.hands?.[chooser.id] || [];
    if (chooserHand.length !== 12) return;

    const card = (deckGame.hands?.[chooser.id] || []).find(
      (item) => item.code === code,
    );

    if (!card || !canRemoveCard(card, currentContract.id)) {
      await patchRoom({
        deckGame: {
          ...deckGame,
          error:
            lang === "ka"
              ? "ამ რეჟიმში ამ კარტის ამოღება არ შეიძლება."
              : "You cannot remove this card in this mode.",
        },
      });
      return;
    }

    const selected = deckGame.selectedToRemove || [];
    const exists = selected.includes(code);

    let nextSelected;

    if (exists) {
      nextSelected = selected.filter((item) => item !== code);
    } else {
      if (selected.length >= 2) return;
      nextSelected = [...selected, code];
    }

    await patchRoom({
      deckGame: {
        ...deckGame,
        selectedToRemove: nextSelected,
        error: "",
      },
    });
  }

  async function removeSelectedCards() {
    if (playerCount !== 3) return;
    if (seatId !== chooser.id) return;
    if (!currentContract) return;

    const selected = deckGame.selectedToRemove || [];
    const chooserHand = deckGame.hands?.[chooser.id] || [];

    if (chooserHand.length !== 12) {
      await patchRoom({
        deckGame: {
          ...deckGame,
          error:
            lang === "ka"
              ? "2 კარტის ამოღებამდე ამრჩევს 12 კარტი უნდა ჰქონდეს."
              : "Chooser must have 12 cards before removing 2.",
        },
      });
      return;
    }

    if (selected.length !== 2) {
      await patchRoom({
        deckGame: { ...deckGame, error: ui.choose2 },
      });
      return;
    }

    const selectedCards = chooserHand.filter((card) =>
      selected.includes(card.code),
    );

    if (
      selectedCards.some((card) => !canRemoveCard(card, currentContract.id))
    ) {
      await patchRoom({
        deckGame: {
          ...deckGame,
          error:
            lang === "ka"
              ? "ამ რეჟიმში ქულიანი კარტის ამოღება არ შეიძლება."
              : "You cannot remove scoring cards in this mode.",
        },
      });
      return;
    }

    await patchRoom({
      deckGame: {
        ...deckGame,
        hands: {
          ...deckGame.hands,
          [chooser.id]: sortCards(
            chooserHand.filter((card) => !selected.includes(card.code)),
          ),
        },
        removedCards: selectedCards,
        selectedToRemove: [],
        currentTurnId: chooser.id,
        error: "",
      },
    });
  }

  async function playCard(card) {
    setPageError("");

    if (seatId !== currentTurnId) {
      setPageError(ui.errors.notYourTurn);
      return;
    }

    if (!currentContract) {
      setPageError(ui.selectModeFirst);
      return;
    }

    const hand = deckGame.hands?.[seatId] || [];
    const check = canPlayCard({
      hand,
      card,
      tableCards,
      contractId: currentContract.id,
      trumpSuit: deckGame.trumpSuit || "",
    });

    if (!check.ok) {
      const customErrors = {
        mustPlayTrump:
          lang === "ka"
            ? "ფერი არ გაქვს, მაგრამ მთავარი ფერი გაქვს, ამიტომ მთავარი ფერი უნდა ჩახვიდე."
            : "You do not have the led suit, but you have main suit, so you must play main suit.",
      };

      setPageError(
        customErrors[check.errorType] ||
          ui.errors[check.errorType] ||
          check.error ||
          "Cannot play this card.",
      );
      return;
    }

    const nextHand = sortCards(hand.filter((item) => item.code !== card.code));
    const nextTableCards = [...tableCards, { playerId: seatId, card }];
    const nextHands = {
      ...deckGame.hands,
      [seatId]: nextHand,
    };

    if (nextTableCards.length < players.length) {
      await patchRoom({
        deckGame: {
          ...deckGame,
          hands: nextHands,
          tableCards: nextTableCards,
          currentTurnId: getNextPlayerId(players, seatId),
          error: "",
        },
      });
      return;
    }

    const winnerId = getTrickWinner(nextTableCards, deckGame.trumpSuit || "");
    const nextTaken = addTrickToTaken({
      taken: deckGame.taken || createTaken(players),
      winnerId,
      tableCards: nextTableCards,
      trickNumber: deckGame.trickNumber || 1,
      maxTricks: deckGame.maxTricks || (playerCount === 3 ? 10 : 8),
    });

    const isRoundOver =
      (deckGame.trickNumber || 1) >= (deckGame.maxTricks || 8);

    await patchRoom({
      deckGame: {
        ...deckGame,
        hands: nextHands,
        tableCards: nextTableCards,
        currentTurnId: winnerId,
        taken: nextTaken,
        lastWinnerId: winnerId,
        roundOver: isRoundOver,
        error: "",
      },
    });
  }

  async function nextTrick() {
    if (!deckGame.lastWinnerId || tableCards.length !== players.length) return;

    await patchRoom({
      deckGame: {
        ...deckGame,
        tableCards: [],
        trickNumber: (deckGame.trickNumber || 1) + 1,
        currentTurnId: deckGame.lastWinnerId,
        lastWinnerId: "",
      },
    });
  }

  function findNextChooserIndex(nextUsedContracts, currentIndex) {
    for (let step = 1; step <= players.length; step += 1) {
      const nextIndex = (currentIndex + step) % players.length;
      const nextPlayer = players[nextIndex];
      const usedCount = nextUsedContracts[nextPlayer.id]?.length || 0;
      if (usedCount < contracts.length) return nextIndex;
    }

    return currentIndex;
  }

  async function finishRound() {
    if (!roundOver || !currentContract) return;

    const result = calculateRoundScores(
      players,
      currentContract,
      deckGame.taken || {},
    );
    const nextHistory = [
      ...history,
      {
        roundNumber: history.length + 1,
        chooserId: chooser.id,
        chooserName: chooser.name,
        contractId: currentContract.id,
        scores: result.scores,
        entries: result.entries,
      },
    ];

    const nextUsedContracts = {
      ...usedContracts,
      [chooser.id]: [...(usedContracts[chooser.id] || []), currentContract.id],
    };

    const nextChooserIndex = findNextChooserIndex(
      nextUsedContracts,
      room.chooserIndex || 0,
    );

    await patchRoom({
      history: nextHistory,
      usedContracts: nextUsedContracts,
      chooserIndex: nextChooserIndex,
      selectedContractId: "",
      deckGame: emptyDeckGame,
    });
  }

  async function copyCode() {
    await navigator.clipboard.writeText(roomCode);
    setMessage(ui.copied);
  }

  function leaveRoom() {
    clearLocal();
    setRoomCode("");
    setSeatId("");
    setRoom(null);
  }

  async function handleSignOut() {
    leaveRoom();
    await signOut(auth);
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="animate-pulse text-6xl text-amber-300">♠</div>
      </main>
    );
  }

  if (!user) {
    return <AuthPage lang={createLang} />;
  }

  if (!roomCode || !room) {
    const lobbyUi = LANGUAGES[createLang].ui;

    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-slate-900 p-5 shadow-2xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black">{lobbyUi.title}</h1>
              <p className="mt-2 text-sm text-slate-400">{lobbyUi.subtitle}</p>
              <p className="mt-2 text-xs font-bold text-amber-300">
                {user.displayName || user.email}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <select
                value={createLang}
                onChange={(event) => setCreateLang(event.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-slate-950 px-3 font-bold outline-none"
              >
                <option value="en">EN</option>
                <option value="ka">KA</option>
              </select>

              <button
                onClick={handleSignOut}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/10"
              >
                {lobbyUi.signOut}
              </button>
            </div>
          </div>

          {pageError && (
            <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">
              {pageError}
            </div>
          )}

          <input
            value={joinName}
            onChange={(event) => setJoinName(event.target.value)}
            placeholder={lobbyUi.yourName}
            className="mb-3 h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 font-bold outline-none focus:border-amber-300"
          />

          <div className="mb-3 grid grid-cols-2 gap-3">
            {[3, 4].map((count) => (
              <button
                key={count}
                onClick={() => setCreateCount(count)}
                className={classNames(
                  "rounded-2xl border p-4 text-left font-black",
                  createCount === count
                    ? "border-amber-300 bg-amber-300 text-slate-950"
                    : "border-white/10 bg-slate-950",
                )}
              >
                {count} {lobbyUi.players}
              </button>
            ))}
          </div>

          <button
            onClick={createRoom}
            disabled={loading}
            className="mb-6 min-h-[58px] w-full rounded-2xl bg-amber-300 px-5 text-lg font-black text-slate-950 hover:bg-amber-200 disabled:opacity-60"
          >
            {lobbyUi.createRoom}
          </button>

          <div className="rounded-2xl bg-slate-950 p-4">
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder={lobbyUi.roomCode}
              className="mb-3 h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 font-bold uppercase outline-none focus:border-amber-300"
            />

            <button
              onClick={joinRoom}
              disabled={loading}
              className="min-h-[58px] w-full rounded-2xl border border-white/10 px-5 text-lg font-black hover:bg-white/10 disabled:opacity-60"
            >
              {lobbyUi.joinRoom}
            </button>
          </div>
        </section>
      </main>
    );
  }

  const topPlayers = players.filter((player) => player.id !== seatId);
  const isMyTurn = seatId === currentTurnId;
  const allSeatsFilled = players.every((player) => player.uid);
  const allReady = players.every(
    (player) => player.ready || player.id === "p1",
  );
  const chooserHandLength = deckGame.hands?.[chooser.id]?.length || 0;
  const mustRemoveCards =
    playerCount === 3 &&
    currentContract &&
    deckGame.modeLocked &&
    chooserHandLength === 12 &&
    (deckGame.removedCards || []).length === 0;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_center,#15414b_0%,#071923_48%,#020617_100%)] text-slate-100">
      <div className="mobile-landscape-scale mx-auto flex min-h-screen max-w-7xl flex-col px-3 py-3 sm:px-5">
        <header className="z-20 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur">
          <div>
            <p className="text-xs font-bold text-amber-300">
              {ui.roomCode}: {roomCode}
            </p>
            <p className="text-lg font-black">{ui.title}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={lang}
              onChange={(event) => changeLanguage(event.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm font-bold outline-none"
            >
              <option value="en">EN</option>
              <option value="ka">KA</option>
            </select>

            <button
              onClick={copyCode}
              className="h-10 rounded-xl border border-white/10 px-3 text-sm font-bold hover:bg-white/10"
            >
              {ui.copyCode}
            </button>

            <button
              onClick={() => setScoreOpen(true)}
              className="h-10 rounded-xl border border-white/10 px-3 text-sm font-bold hover:bg-white/10"
            >
              {ui.scoreboard}
            </button>

            <button
              onClick={leaveRoom}
              className="h-10 rounded-xl border border-white/10 px-3 text-sm font-bold text-rose-200 hover:bg-white/10"
            >
              {ui.leaveRoom}
            </button>
          </div>
        </header>

        {pageError && (
          <div className="z-20 mb-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">
            {pageError}
          </div>
        )}

        {deckGame.error && (
          <div className="z-20 mb-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">
            {deckGame.error}
          </div>
        )}

        {gameStatus === "lobby" && (
          <section className="mx-auto mt-8 w-full max-w-3xl rounded-[2rem] border border-white/10 bg-slate-950/80 p-5 shadow-2xl backdrop-blur">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-3xl font-black">{ui.waiting}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {language.rules[playerCount]}
                </p>
              </div>

              {isHost && (
                <button
                  onClick={startGame}
                  disabled={!allSeatsFilled || !allReady}
                  className="min-h-[52px] rounded-2xl bg-amber-300 px-5 font-black text-slate-950 disabled:opacity-50"
                >
                  {ui.startGame}
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="rounded-2xl border border-white/10 bg-slate-900 p-4"
                >
                  <p className="font-black">{player.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {player.uid
                      ? player.ready
                        ? ui.ready
                        : ui.notReady
                      : ui.waitingPlayers}
                  </p>
                </div>
              ))}
            </div>

            {me && seatId !== "p1" && (
              <button
                onClick={toggleReady}
                className="mt-5 min-h-[52px] w-full rounded-2xl border border-white/10 bg-slate-900 px-5 font-black hover:bg-white/10"
              >
                {me.ready ? ui.notReady : ui.ready}
              </button>
            )}
          </section>
        )}

        {gameStatus === "playing" && (
          <>
            {/* Rotate prompt — portrait phones only */}
            <div className="flex flex-col items-center justify-center gap-6 rounded-[2rem] border border-white/10 bg-slate-900/80 p-10 text-center landscape:hidden sm:hidden">
              <div className="text-7xl animate-bounce">📱</div>
              <p className="text-2xl font-black text-amber-300">
                {lang === "ka" ? "ტელეფონი მობრუნე" : "Rotate your phone"}
              </p>
              <p className="text-sm text-slate-400">
                {lang === "ka"
                  ? "თამაში ჰორიზონტალურ რეჟიმში მუშაობს"
                  : "The game works in landscape mode"}
              </p>
              <div className="text-5xl opacity-50">↻</div>
            </div>

            <section className="relative hidden flex-col rounded-[2rem] border border-white/10 bg-emerald-950/20 p-3 shadow-2xl backdrop-blur landscape:flex sm:flex sm:p-4">
              <div className="flex min-h-[88px] items-start justify-around gap-3 lg:min-h-[96px]">
                {topPlayers.map((player) => {
                  const handLength = deckGame.hands?.[player.id]?.length || 0;
                  const active = currentTurnId === player.id;

                  return (
                    <div
                      key={player.id}
                      className="flex flex-col items-center gap-2"
                    >
                      <div
                        className={classNames(
                          "rounded-2xl border px-4 py-2 text-center shadow-lg",
                          active
                            ? "border-amber-300 bg-amber-300 text-slate-950 shadow-glow"
                            : "border-white/10 bg-slate-950/80",
                        )}
                      >
                        <p className="text-sm font-black">{player.name}</p>
                        <p className="text-xs opacity-70">
                          {handLength} {ui.cards}
                        </p>
                      </div>

                      <div className="flex justify-center">
                        {Array.from({ length: Math.min(handLength, 10) }).map(
                          (_, index) => (
                            <div
                              key={index}
                              className="card-fan h-12 w-8 rounded-md border border-white/10 bg-[repeating-linear-gradient(45deg,#7f1d1d,#7f1d1d_4px,#f8fafc_4px,#f8fafc_7px)] shadow-md sm:h-14 sm:w-10"
                            />
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[240px_1fr_240px]">
                <aside className="order-2 rounded-3xl border border-white/10 bg-slate-950/70 p-4 lg:order-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {ui.chooseMode}
                  </p>

                  {!deckGame.deckId && (
                    <p className="mt-3 rounded-2xl bg-slate-900 p-3 text-sm font-bold text-slate-400">
                      {lang === "ka"
                        ? "ჯერ დაარიგე 10 კარტი ყველა მოთამაშეზე."
                        : "Deal 10 cards to everyone first."}
                    </p>
                  )}

                  {deckGame.deckId &&
                    deckGame.modeLocked &&
                    currentContract && (
                      <div className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3">
                        <p className="text-sm font-black text-amber-200">
                          {currentContract.name}
                        </p>
                        {currentContract.id === "tricks-positive" &&
                          deckGame.trumpSuit && (
                            <p className="mt-1 text-xs font-bold text-emerald-300">
                              {lang === "ka" ? "მთავარი ფერი" : "Main suit"}:{" "}
                              {suitName(deckGame.trumpSuit, lang)}
                            </p>
                          )}
                      </div>
                    )}

                  {deckGame.deckId && !deckGame.modeLocked && (
                    <div className="mt-3 space-y-2">
                      {contracts.map((contract) => {
                        const used = (usedContracts[chooser.id] || []).includes(
                          contract.id,
                        );
                        const selected = currentContract?.id === contract.id;
                        const canChoose = seatId === chooser.id && !used;

                        return (
                          <button
                            key={contract.id}
                            disabled={!canChoose}
                            onClick={() => chooseContract(contract)}
                            className={classNames(
                              "w-full rounded-2xl border p-3 text-left text-sm transition",
                              selected
                                ? "border-amber-300 bg-amber-300/10 text-amber-100"
                                : "border-white/10 bg-slate-900/80 text-slate-300",
                              used && "opacity-35",
                              !canChoose && "cursor-not-allowed",
                            )}
                          >
                            <p className="font-black">{contract.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {used ? ui.alreadyUsed : contract.scoringText}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {deckGame.deckId &&
                    !deckGame.modeLocked &&
                    currentContract &&
                    seatId === chooser.id && (
                      <button
                        onClick={confirmMode}
                        className="mt-4 min-h-[52px] w-full rounded-2xl bg-amber-300 px-4 font-black text-slate-950 hover:bg-amber-200"
                      >
                        {lang === "ka" ? "რეჟიმის დადასტურება" : "Confirm mode"}
                      </button>
                    )}
                </aside>

                <div className="order-1 flex min-h-[260px] flex-col justify-between rounded-[2rem] border border-white/10 bg-black/10 p-3 lg:order-2 lg:min-h-[300px]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                      <p className="text-xs font-bold text-slate-500">
                        {ui.chooser}
                      </p>
                      <p className="font-black text-amber-200">
                        {chooser.name}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-right">
                      <p className="text-xs font-bold text-slate-500">
                        {ui.turn}
                      </p>
                      <p
                        className={classNames(
                          "font-black",
                          isMyTurn ? "text-amber-300" : "text-slate-100",
                        )}
                      >
                        {currentTurnId
                          ? isMyTurn
                            ? ui.yourTurn
                            : players.find((p) => p.id === currentTurnId)?.name
                          : currentContract
                            ? mustRemoveCards
                              ? lang === "ka"
                                ? "ამოიღე 2 კარტი"
                                : "Remove 2 cards"
                              : lang === "ka"
                                ? "რაუნდი დაიწყება"
                                : "Round will start"
                            : lang === "ka"
                              ? "რეჟიმის არჩევა"
                              : "Choose mode"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-1 items-center justify-center py-3 lg:py-4">
                    <div className="relative w-full max-w-4xl rounded-[2rem] border border-white/10 bg-emerald-900/30 p-3 flex flex-col gap-3">
                      {/* Table area: opponents + my played card */}
                      <div className="flex flex-wrap items-end justify-center gap-4">
                        {/* Opponents' played cards */}
                        {players
                          .filter((p) => p.id !== seatId)
                          .map((player) => {
                            const played = tableCards.find(
                              (item) => item.playerId === player.id,
                            );
                            return (
                              <div
                                key={player.id}
                                className="flex flex-col items-center gap-2"
                              >
                                <p className="text-xs font-bold text-slate-300">
                                  {player.name}
                                </p>
                                {played ? (
                                  <img
                                    src={played.card.image}
                                    alt={played.card.code}
                                    className="w-14 rounded-lg shadow-2xl sm:w-16 lg:w-[70px]"
                                  />
                                ) : (
                                  <div className="flex h-20 w-14 items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-slate-500 sm:h-24 sm:w-16">
                                    —
                                  </div>
                                )}
                              </div>
                            );
                          })}

                        {/* My played card */}
                        {(() => {
                          const myPlayed = tableCards.find(
                            (item) => item.playerId === seatId,
                          );
                          return (
                            <div className="flex flex-col items-center gap-2">
                              <p className="text-xs font-bold text-amber-300">
                                {me?.name} ({ui.you || "you"})
                              </p>
                              {myPlayed ? (
                                <img
                                  src={myPlayed.card.image}
                                  alt={myPlayed.card.code}
                                  className="w-14 rounded-lg shadow-2xl sm:w-16 lg:w-[70px]"
                                />
                              ) : (
                                <div className="flex h-20 w-14 items-center justify-center rounded-lg border border-dashed border-amber-300/20 text-xs text-amber-300/40 sm:h-24 sm:w-16">
                                  —
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Divider */}
                      <div className="border-t border-white/10" />

                      {/* My hand at the bottom */}
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-xs font-bold text-amber-300">
                          {me?.name} — {myHand.length} {ui.cards}
                        </p>
                        {myHand.length === 0 ? (
                          <p className="rounded-2xl bg-slate-900/60 px-4 py-3 text-sm text-slate-500">
                            {ui.noCards}
                          </p>
                        ) : (
                          <div className="flex w-full items-end justify-center overflow-x-auto overflow-y-visible pb-2 pt-6">
                            {myHand.map((card) => {
                              const selected = (
                                deckGame.selectedToRemove || []
                              ).includes(card.code);
                              const canRemove =
                                mustRemoveCards && seatId === chooser.id;
                              const protectedRemove =
                                canRemove &&
                                currentContract &&
                                isProtectedRemoveCard(card, currentContract.id);
                              const canPlay =
                                !canRemove &&
                                isMyTurn &&
                                tableCards.length < players.length &&
                                !roundOver;

                              return (
                                <button
                                  key={card.code}
                                  disabled={protectedRemove}
                                  title={
                                    protectedRemove
                                      ? lang === "ka"
                                        ? "ამ რეჟიმში ამ კარტის ამოღება არ შეიძლება"
                                        : "You cannot remove this card in this mode"
                                      : ""
                                  }
                                  onClick={() =>
                                    canRemove
                                      ? toggleRemoveCard(card.code)
                                      : canPlay && playCard(card)
                                  }
                                  className={classNames(
                                    "card-fan shrink-0 rounded-xl border p-1 transition duration-150",
                                    selected
                                      ? "-translate-y-3 border-amber-300 bg-amber-300/20"
                                      : "border-transparent",
                                    protectedRemove &&
                                      "cursor-not-allowed opacity-45 grayscale",
                                    (canPlay || canRemove) &&
                                      !protectedRemove &&
                                      "hover:-translate-y-3",
                                    !canPlay && !canRemove && "cursor-default",
                                  )}
                                >
                                  <img
                                    src={card.image}
                                    alt={card.code}
                                    className="playing-card-img rounded-lg shadow-xl"
                                  />
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {mustRemoveCards && seatId === chooser.id && (
                          <p className="text-xs font-bold text-amber-300">
                            {ui.choose2}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    {!deckGame.deckId && (
                      <button
                        onClick={dealCards}
                        disabled={
                          seatId !== chooser.id ||
                          deckGame.loading ||
                          gameFinished
                        }
                        className="min-h-[52px] rounded-2xl bg-amber-300 px-6 font-black text-slate-950 disabled:opacity-50"
                      >
                        {deckGame.loading ? ui.dealing : ui.dealCards}
                      </button>
                    )}

                    {mustRemoveCards && seatId === chooser.id && (
                      <button
                        onClick={removeSelectedCards}
                        className="min-h-[52px] rounded-2xl border border-amber-300/40 bg-amber-300/10 px-6 font-black text-amber-100"
                      >
                        {ui.remove2}
                      </button>
                    )}

                    {tableCards.length === players.length && !roundOver && (
                      <button
                        onClick={nextTrick}
                        className="min-h-[52px] rounded-2xl border border-white/10 bg-slate-950/70 px-6 font-black hover:bg-white/10"
                      >
                        {ui.passToNext}
                      </button>
                    )}

                    {roundOver && (
                      <button
                        onClick={finishRound}
                        className="min-h-[52px] rounded-2xl bg-amber-300 px-6 font-black text-slate-950"
                      >
                        {ui.roundDone}
                      </button>
                    )}
                  </div>
                </div>

                <aside className="order-3 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {ui.scoreboard}
                  </p>

                  <div className="mt-3 space-y-2">
                    {[...players]
                      .sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))
                      .map((player, index) => (
                        <div
                          key={player.id}
                          className="flex justify-between rounded-2xl bg-slate-900/80 p-3 text-sm"
                        >
                          <span className="font-bold">
                            {index + 1}. {player.name}
                          </span>
                          <span
                            className={classNames(
                              "font-black",
                              (totals[player.id] || 0) >= 0
                                ? "text-emerald-300"
                                : "text-rose-300",
                            )}
                          >
                            {totals[player.id] || 0}
                          </span>
                        </div>
                      ))}
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-900/80 p-3">
                    <p className="text-xs font-bold text-slate-500">
                      {currentContract ? currentContract.name : ui.chooseMode}
                    </p>
                    <p className="mt-1 text-sm font-black text-amber-200">
                      {currentContract
                        ? currentContract.maxText
                        : lang === "ka"
                          ? "ჯერ 10 კარტი დარიგდება, შემდეგ ამრჩევი აირჩევს რეჟიმს."
                          : "First deal 10 cards, then chooser chooses mode."}
                    </p>
                  </div>

                  {currentContract?.id === "tricks-positive" &&
                    !deckGame.trumpLocked && (
                      <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-amber-200">
                          {lang === "ka" ? "მთავარი ფერი" : "Main suit"}
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-2">
                          {SUITS.map((suit) => {
                            const active = deckGame.trumpSuit === suit.id;
                            const disabled =
                              seatId !== chooser.id || deckGame.trumpLocked;

                            return (
                              <button
                                key={suit.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => chooseTrumpSuit(suit.id)}
                                className={classNames(
                                  "min-h-[44px] rounded-xl border px-3 py-2 text-left font-black transition",
                                  active
                                    ? "border-amber-300 bg-amber-300 text-slate-950"
                                    : "border-white/10 bg-slate-950 text-slate-100 hover:bg-white/10",
                                  disabled && "cursor-not-allowed opacity-60",
                                )}
                              >
                                <span
                                  className={
                                    suit.id === "H" || suit.id === "D"
                                      ? "text-rose-400"
                                      : ""
                                  }
                                >
                                  {suit.label}
                                </span>{" "}
                                {lang === "ka" ? suit.nameKa : suit.nameEn}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {currentContract?.id === "tricks-positive" &&
                    deckGame.trumpLocked &&
                    deckGame.trumpSuit && (
                      <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-3">
                        <p className="text-xs font-bold text-emerald-200">
                          {lang === "ka"
                            ? "არჩეული მთავარი ფერი"
                            : "Locked main suit"}
                        </p>
                        <p className="mt-1 text-lg font-black text-emerald-300">
                          {suitName(deckGame.trumpSuit, lang)}
                        </p>
                      </div>
                    )}

                  {deckGame.removedCards?.length > 0 && (
                    <div className="mt-4 rounded-2xl bg-slate-900/80 p-3">
                      <p className="mb-2 text-xs font-bold text-slate-500">
                        {ui.removedCards}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {deckGame.removedCards.map((card) => (
                          <img
                            key={card.code}
                            src={card.image}
                            alt={card.code}
                            className="w-10 rounded"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </section>
          </>
        )}

        {scoreOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[86vh] w-full max-w-4xl overflow-auto rounded-[2rem] border border-white/10 bg-slate-950 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black">{ui.history}</h2>
                <button
                  onClick={() => setScoreOpen(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 font-bold hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              {history.length === 0 ? (
                <p className="rounded-2xl bg-slate-900 p-4 text-slate-500">—</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-separate border-spacing-y-2 text-sm">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">{ui.chooser}</th>
                        <th className="px-3 py-2 text-left">{ui.chooseMode}</th>
                        {players.map((player) => (
                          <th key={player.id} className="px-3 py-2 text-right">
                            {player.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((round) => {
                        const contract = contracts.find(
                          (item) => item.id === round.contractId,
                        );

                        return (
                          <tr key={round.roundNumber} className="bg-slate-900">
                            <td className="rounded-l-2xl px-3 py-3 font-bold">
                              {round.roundNumber}
                            </td>
                            <td className="px-3 py-3 font-bold">
                              {round.chooserName}
                            </td>
                            <td className="px-3 py-3 font-bold">
                              {contract?.name || round.contractId}
                            </td>
                            {players.map((player, index) => (
                              <td
                                key={player.id}
                                className={classNames(
                                  "px-3 py-3 text-right font-black",
                                  index === players.length - 1 &&
                                    "rounded-r-2xl",
                                  (round.scores?.[player.id] || 0) >= 0
                                    ? "text-emerald-300"
                                    : "text-rose-300",
                                )}
                              >
                                {round.scores?.[player.id] || 0}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
