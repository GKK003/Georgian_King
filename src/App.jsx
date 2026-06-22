import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { ScreenOrientation } from "@capacitor/screen-orientation";
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
import RulesPage from "./RulesPage";
import {
  KING_DECK_CODES,
  TRUMP_OPTIONS,
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
const AUTO_NEXT_TRICK_DELAY_MS = 1500;

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

function isSupportedPlayerCount(count) {
  return count === 3;
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
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...loadLocal(), ...data }));
}

function clearLocal() {
  const { lang, name } = loadLocal();
  const nextLocal = {};

  if (lang) nextLocal.lang = lang;
  if (name) nextLocal.name = name;

  if (Object.keys(nextLocal).length) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(nextLocal));
  } else {
    localStorage.removeItem(LOCAL_KEY);
  }
}

function suitName(suit, lang) {
  const found = TRUMP_OPTIONS.find((item) => item.id === suit);
  if (!found) return "";
  return lang === "ge" ? found.nameGe : found.nameEn;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const local = loadLocal();

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [roomCode, setRoomCode] = useState(local.roomCode || "");
  const [seatId, setSeatId] = useState(local.seatId || "");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState(local.name || "");
  const createCount = 3;
  const [createLang, setCreateLang] = useState(local.lang || "en");
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [message, setMessage] = useState("");
  const [scoreOpen, setScoreOpen] = useState(false);

  const lang = createLang;
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

        if (!isSupportedPlayerCount(data.playerCount || 3)) {
          clearLocal();
          setRoomCode("");
          setSeatId("");
          setRoom(null);
          setPageError(
            createLang === "ge"
              ? "ეს ვერსია მხოლოდ 3 მოთამაშისთვის არის."
              : "This version only supports 3-player rooms.",
          );
          return;
        }

        setRoom(data);

        if (user?.uid) {
          const seat = getSeatByUid(data.players || [], user.uid);
          if (seat) {
            setSeatId(seat.id);
            saveLocal({
              roomCode,
              seatId: seat.id,
              name: seat.name,
              lang: createLang,
            });
          }
        }
      },
      (error) => setPageError(error.message),
    );

    return () => unsub();
  }, [roomCode, user?.uid, createLang]);

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
  const lastWinnerId = deckGame.lastWinnerId || "";
  const myHand = deckGame.hands?.[seatId] || [];
  const tableCards = deckGame.tableCards || [];
  const roundOver = deckGame.roundOver || false;
  const totalRounds = contracts.length * players.length;
  const gameFinished = history.length >= totalRounds;
  const tableLeadId = tableCards[0]?.playerId || currentTurnId || players[0]?.id;
  const tablePlayers = useMemo(() => {
    if (!players.length) return [];

    const leadIndex = players.findIndex((player) => player.id === tableLeadId);
    const startIndex = leadIndex >= 0 ? leadIndex : 0;

    return [...players.slice(startIndex), ...players.slice(0, startIndex)];
  }, [players, tableLeadId]);
  const chooserHandLength = deckGame.hands?.[chooser.id]?.length || 0;
  const mustRemoveCards =
    currentContract &&
    deckGame.modeLocked &&
    chooserHandLength === 12 &&
    (deckGame.removedCards || []).length === 0;
  const selectedRemoveCount = (deckGame.selectedToRemove || []).length;
  const showPhoneModePopup =
    gameStatus === "playing" &&
    deckGame.deckId &&
    !deckGame.modeLocked &&
    seatId === chooser.id;
  const showPhoneRemoveDock =
    gameStatus === "playing" && mustRemoveCards && seatId === chooser.id;
  const phoneChoiceOpen = showPhoneModePopup;
  const canConfirmMode =
    currentContract &&
    (currentContract.id !== "tricks-positive" || deckGame.trumpSuit);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const isGameScreen =
      location.pathname === "/game" && gameStatus === "playing";

    async function applyOrientation() {
      try {
        if (isGameScreen) {
          await ScreenOrientation.lock({ orientation: "landscape" });
        } else {
          await ScreenOrientation.unlock();
        }
      } catch (error) {
        console.warn("Could not update screen orientation", error);
      }
    }

    applyOrientation();
  }, [location.pathname, gameStatus]);

  useEffect(() => {
    if (!phoneChoiceOpen) return;
    if (typeof window === "undefined") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [phoneChoiceOpen]);

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

  useEffect(() => {
    if (gameStatus !== "playing") return;
    if (roundOver) return;
    if (!lastWinnerId) return;
    if (tableCards.length !== players.length) return;

    const timer = window.setTimeout(() => {
      patchRoom({
        deckGame: {
          ...deckGame,
          tableCards: [],
          trickNumber: (deckGame.trickNumber || 1) + 1,
          currentTurnId: lastWinnerId,
          lastWinnerId: "",
          error: "",
        },
      }).catch((error) => setPageError(error.message));
    }, AUTO_NEXT_TRICK_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    deckGame,
    gameStatus,
    lastWinnerId,
    players.length,
    roundOver,
    tableCards.length,
  ]);

  function addExtraCardsToChooser(baseDeck = deckGame) {
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
      const playersList = createPlayers(3);

      playersList[0] = {
        ...playersList[0],
        name,
        uid: user.uid,
        ready: true,
      };

      await setDoc(doc(db, "kingRooms", code), {
        playerCount: 3,
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

      if (!isSupportedPlayerCount(data.playerCount || 3)) {
        setPageError(
          lang === "ge"
            ? "ეს ვერსია მხოლოდ 3 მოთამაშისთვის არის."
            : "This version only supports 3-player rooms.",
        );
        return;
      }

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
        lang: createLang,
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

  function changeLanguage(nextLang) {
    setCreateLang(nextLang);
    saveLocal({ lang: nextLang });
  }

  function changeCreateLanguage(nextLang) {
    setCreateLang(nextLang);
    saveLocal({ lang: nextLang });
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
        const give = 10;
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
          pendingExtraCards: drawData.cards.slice(cardIndex, cardIndex + 2),
          maxTricks: 10,
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
        lang === "ge"
          ? "აირჩიე კოზირი ან კოზირის გარეშე."
          : "Choose a main suit or without main suit.",
      );
      return;
    }

    const withExtra = addExtraCardsToChooser(deckGame);

    await patchRoom({
      deckGame: {
        ...withExtra,
        trumpLocked: currentContract.id === "tricks-positive",
        modeLocked: true,
        currentTurnId: "",
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
            lang === "ge"
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
    if (seatId !== chooser.id) return;
    if (!currentContract) return;

    const selected = deckGame.selectedToRemove || [];
    const chooserHand = deckGame.hands?.[chooser.id] || [];

    if (chooserHand.length !== 12) {
      await patchRoom({
        deckGame: {
          ...deckGame,
          error:
            lang === "ge"
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
            lang === "ge"
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
          lang === "ge"
            ? "ფერი არ გაქვს, მაგრამ კოზირი გაქვს, ამიტომ კოზირი უნდა ჩახვიდე."
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
      maxTricks: deckGame.maxTricks || 10,
    });

    const currentTrickNumber = deckGame.trickNumber || 1;
    const kingOfHeartsTaken =
      currentContract.id === "no-king-heart" &&
      nextTableCards.some((item) => item.card.code === "KH");
    const isRoundOver =
      kingOfHeartsTaken ||
      currentTrickNumber >= (deckGame.maxTricks || 10);

    await patchRoom({
      deckGame: {
        ...deckGame,
        hands: nextHands,
        tableCards: nextTableCards,
        currentTurnId: winnerId,
        taken: nextTaken,
        trickNumber: currentTrickNumber,
        lastWinnerId: isRoundOver ? "" : winnerId,
        roundOver: isRoundOver,
        error: "",
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
    navigate("/room", { replace: true });
  }

  async function handleSignOut() {
    leaveRoom();
    await signOut(auth);
    if (Capacitor.isNativePlatform()) {
      await FirebaseAuthentication.signOut().catch(() => {});
    }
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="animate-pulse text-6xl text-amber-300">♠</div>
      </main>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage lang={createLang} />} />
        <Route
          path="/rules"
          element={<RulesPage backTo="/auth" lang={createLang} />}
        />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  if (!roomCode || !room) {
    const lobbyUi = LANGUAGES[createLang].ui;

    return (
      <Routes>
        <Route path="/" element={<Navigate to="/room" replace />} />
        <Route path="/auth" element={<Navigate to="/room" replace />} />
        <Route path="/lobby" element={<Navigate to="/room" replace />} />
        <Route path="/game" element={<Navigate to="/room" replace />} />
        <Route
          path="/rules"
          element={<RulesPage backTo="/room" lang={createLang} />}
        />
        <Route
          path="/room"
          element={
            <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
              <section className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-slate-900 p-5 shadow-2xl">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-4xl font-black">{lobbyUi.title}</h1>
                    <p className="mt-2 text-sm text-slate-400">
                      {lobbyUi.subtitle}
                    </p>
                    <p className="mt-2 text-xs font-bold text-amber-300">
                      {user.displayName || user.email}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <select
                      value={createLang}
                      onChange={(event) =>
                        changeCreateLanguage(event.target.value)
                      }
                      className="h-11 rounded-xl border border-white/10 bg-slate-950 px-3 font-bold outline-none"
                    >
                      <option value="en">EN</option>
                      <option value="ge">ge</option>
                    </select>

                    <button
                      onClick={handleSignOut}
                      className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-400 hover:bg-white/10"
                    >
                      {lobbyUi.signOut}
                    </button>

                    <Link
                      to="/rules"
                      className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-center text-xs font-black text-amber-100 hover:bg-amber-300/20"
                    >
                      {createLang === "ge" ? "წესები" : "Rules"}
                    </Link>
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

                <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-300 p-4 text-left font-black text-slate-950">
                  3 {lobbyUi.players}
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
          }
        />
        <Route path="*" element={<Navigate to="/room" replace />} />
      </Routes>
    );
  }

  const topPlayers = players.filter((player) => player.id !== seatId);
  const isMyTurn = seatId === currentTurnId;
  const allSeatsFilled = players.every((player) => player.uid);
  const allReady = players.every(
    (player) => player.ready || player.id === "p1",
  );

  const activeRoomPath = gameStatus === "playing" ? "/game" : "/lobby";
  const roomSessionPage = (
    <main
      className={classNames(
        "room-session-page min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_center,#15414b_0%,#071923_48%,#020617_100%)] text-slate-100",
        gameStatus === "playing" && "phone-room-session-page",
      )}
    >
      <div
        className={classNames(
          "room-session-shell mobile-landscape-scale mx-auto flex min-h-screen max-w-7xl flex-col px-3 py-3 sm:px-5",
          gameStatus === "playing" && "phone-game-shell",
        )}
      >
        <header className="game-topbar z-20 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur">
          <div>
            <p className="text-xs font-bold text-amber-300">
              {ui.roomCode}: {roomCode}
            </p>
            <p className="text-lg font-black">{ui.title}</p>
          </div>

          <div className="game-topbar-actions flex flex-wrap gap-2">
            <select
              value={lang}
              onChange={(event) => changeLanguage(event.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm font-bold outline-none"
            >
              <option value="en">EN</option>
              <option value="ge">ge</option>
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

              <Link
                to="/rules"
                className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-center text-xs font-black text-amber-100 hover:bg-amber-300/20"
              >
                {createLang === "ge" ? "წესები" : "Rules"}
              </Link>
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
                {lang === "ge" ? "ტელეფონი მობრუნე" : "Rotate your phone"}
              </p>
              <p className="text-sm text-slate-400">
                {lang === "ge"
                  ? "თამაში ჰორიზონტალურ რეჟიმში მუშაობს"
                  : "The game works in landscape mode"}
              </p>
              <div className="text-5xl opacity-50">↻</div>
            </div>

            <section className="game-board relative hidden flex-col rounded-[2rem] border border-white/10 bg-emerald-950/20 p-3 shadow-2xl backdrop-blur landscape:flex sm:flex sm:p-4">
              <div className="opponents-strip flex min-h-[88px] items-start justify-around gap-3 lg:min-h-[96px]">
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
                          "opponent-badge rounded-2xl border px-4 py-2 text-center shadow-lg",
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

                      <div className="opponent-card-stack flex justify-center">
                        {Array.from({ length: Math.min(handLength, 10) }).map(
                          (_, index) => (
                            <div
                              key={index}
                              className="opponent-card-back card-fan h-12 w-8 rounded-md border border-white/10 bg-[repeating-linear-gradient(45deg,#7f1d1d,#7f1d1d_4px,#f8fafc_4px,#f8fafc_7px)] shadow-md sm:h-14 sm:w-10"
                            />
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="game-layout-grid grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[240px_1fr_240px]">
                <aside className="mode-panel order-2 rounded-3xl border border-white/10 bg-slate-950/70 p-4 lg:order-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {ui.chooseMode}
                  </p>

                  {!deckGame.deckId && (
                    <p className="mt-3 rounded-2xl bg-slate-900 p-3 text-sm font-bold text-slate-400">
                      {lang === "ge"
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
                              {lang === "ge" ? "კოზირი" : "Main suit"}:{" "}
                              {suitName(deckGame.trumpSuit, lang)}
                            </p>
                          )}
                      </div>
                    )}

                  {false && deckGame.deckId && !deckGame.modeLocked && (
                    <div className="mode-list mt-3 space-y-2">
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
                              "mode-option w-full rounded-2xl border p-3 text-left text-sm transition",
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

                  {false &&
                    deckGame.deckId &&
                    !deckGame.modeLocked &&
                    currentContract &&
                    seatId === chooser.id && (
                      <button
                        onClick={confirmMode}
                        className="mode-confirm-button mt-4 min-h-[52px] w-full rounded-2xl bg-amber-300 px-4 font-black text-slate-950 hover:bg-amber-200"
                      >
                        {lang === "ge" ? "რეჟიმის დადასტურება" : "Confirm mode"}
                      </button>
                    )}
                  {deckGame.deckId && !deckGame.modeLocked && (
                    <p className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm font-bold text-amber-100">
                      {seatId === chooser.id
                        ? lang === "ge"
                          ? "რეჟიმი აირჩიე popup-იდან."
                          : "Choose mode from the popup."
                        : lang === "ge"
                          ? "ველოდებით ამრჩევს."
                          : "Waiting for chooser."}
                    </p>
                  )}
                </aside>

                <div className="play-panel order-1 flex min-h-[260px] flex-col justify-between rounded-[2rem] border border-white/10 bg-black/10 p-3 lg:order-2 lg:min-h-[300px]">
                  <div className="play-status-row flex flex-wrap items-center justify-between gap-3">
                    <div className="play-status-card rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
                      <p className="text-xs font-bold text-slate-500">
                        {ui.chooser}
                      </p>
                      <p className="font-black text-amber-200">
                        {chooser.name}
                      </p>
                    </div>

                    <div className="play-status-card rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-right">
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
                              ? lang === "ge"
                                ? "ამოიღე 2 კარტი"
                                : "Remove 2 cards"
                              : lang === "ge"
                                ? "რაუნდი დაიწყება"
                                : "Round will start"
                            : lang === "ge"
                              ? "რეჟიმის არჩევა"
                              : "Choose mode"}
                      </p>
                    </div>
                  </div>

                  <div className="table-stage flex flex-1 items-center justify-center py-3 lg:py-4">
                    <div className="table-surface relative w-full max-w-4xl rounded-[2rem] border border-white/10 bg-emerald-900/30 p-3 flex flex-col gap-3">
                      {/* Table area ordered from the player who led the trick */}
                      <div className="played-cards-row flex flex-wrap items-end justify-center gap-4">
                        {/* Played cards */}
                        {tablePlayers.map((player) => {
                          const played = tableCards.find(
                            (item) => item.playerId === player.id,
                          );
                          const isMe = player.id === seatId;

                          return (
                            <div
                              key={player.id}
                              className="flex flex-col items-center gap-2"
                            >
                              <p
                                className={classNames(
                                  "table-player-name text-xs font-bold",
                                  isMe ? "text-amber-300" : "text-slate-300",
                                )}
                              >
                                {player.name}
                                {isMe ? ` (${ui.you || "you"})` : ""}
                              </p>
                              {played ? (
                                <img
                                  src={played.card.image}
                                  alt={played.card.code}
                                  className="table-card-img w-14 rounded-lg shadow-2xl sm:w-16 lg:w-[70px]"
                                />
                              ) : (
                                <div
                                  className={classNames(
                                    "table-card-placeholder flex h-20 w-14 items-center justify-center rounded-lg border border-dashed text-xs sm:h-24 sm:w-16",
                                    isMe
                                      ? "border-amber-300/20 text-amber-300/40"
                                      : "border-white/15 text-slate-500",
                                  )}
                                >
                                  —
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className="hidden">
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
                                <p className="table-player-name text-xs font-bold text-slate-300">
                                  {player.name}
                                </p>
                                {played ? (
                                  <img
                                    src={played.card.image}
                                    alt={played.card.code}
                                    className="table-card-img w-14 rounded-lg shadow-2xl sm:w-16 lg:w-[70px]"
                                  />
                                ) : (
                                  <div className="table-card-placeholder flex h-20 w-14 items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-slate-500 sm:h-24 sm:w-16">
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
                              <p className="table-player-name text-xs font-bold text-amber-300">
                                {me?.name} ({ui.you || "you"})
                              </p>
                              {myPlayed ? (
                                <img
                                  src={myPlayed.card.image}
                                  alt={myPlayed.card.code}
                                  className="table-card-img w-14 rounded-lg shadow-2xl sm:w-16 lg:w-[70px]"
                                />
                              ) : (
                                <div className="table-card-placeholder flex h-20 w-14 items-center justify-center rounded-lg border border-dashed border-amber-300/20 text-xs text-amber-300/40 sm:h-24 sm:w-16">
                                  —
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-white/10" />

                      {/* My hand at the bottom */}
                      <div className="flex flex-col items-center gap-1">
                        <p className="hand-label text-xs font-bold text-amber-300">
                          {me?.name} — {myHand.length} {ui.cards}
                        </p>
                        {myHand.length === 0 ? (
                          <p className="rounded-2xl bg-slate-900/60 px-4 py-3 text-sm text-slate-500">
                            {ui.noCards}
                          </p>
                        ) : (
                          <div
                            className="hand-scroll w-full items-end justify-center overflow-x-hidden overflow-y-visible pb-2 pt-6"
                            style={{
                              "--hand-count": myHand.length,
                              "--hand-max-width": `${myHand.length * 88}px`,
                            }}
                          >
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
                                      ? lang === "ge"
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
                                    "card-button card-fan shrink-0 rounded-xl border p-1 transition duration-150",
                                    selected
                                      ? "hand-card-selected -translate-y-3 border-amber-300 bg-amber-300/20"
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

                  <div className="action-row flex flex-wrap justify-center gap-3">
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

                    {false && mustRemoveCards && seatId === chooser.id && (
                      <button
                        onClick={removeSelectedCards}
                        disabled={selectedRemoveCount !== 2}
                        className="desktop-choice-action min-h-[52px] rounded-2xl border border-amber-300/40 bg-amber-300/10 px-6 font-black text-amber-100 disabled:opacity-50"
                      >
                        {ui.remove2}
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

                <aside className="score-panel order-3 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    {ui.scoreboard}
                  </p>

                  <div className="score-list mt-3 space-y-2">
                    {[...players]
                      .sort((a, b) => (totals[b.id] || 0) - (totals[a.id] || 0))
                      .map((player, index) => (
                        <div
                          key={player.id}
                          className="score-row flex justify-between rounded-2xl bg-slate-900/80 p-3 text-sm"
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

                  <div className="contract-summary mt-4 rounded-2xl bg-slate-900/80 p-3">
                    <p className="text-xs font-bold text-slate-500">
                      {currentContract ? currentContract.name : ui.chooseMode}
                    </p>
                    <p className="mt-1 text-sm font-black text-amber-200">
                      {currentContract
                        ? currentContract.maxText
                        : lang === "ge"
                          ? "ჯერ 10 კარტი დარიგდება, შემდეგ ამრჩევი აირჩევს რეჟიმს."
                          : "First deal 10 cards, then chooser chooses mode."}
                    </p>
                  </div>

                  {false &&
                    currentContract?.id === "tricks-positive" &&
                    !deckGame.trumpLocked && (
                      <div className="trump-panel mt-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-amber-200">
                          {lang === "ge" ? "კოზირი" : "Main suit"}
                        </p>

                        <div className="trump-suit-grid mt-3 grid grid-cols-1 gap-2">
                          {TRUMP_OPTIONS.map((suit) => {
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
                                  "trump-suit-button",
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
                                {lang === "ge" ? suit.nameGe : suit.nameEn}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {currentContract?.id === "tricks-positive" &&
                    deckGame.trumpLocked &&
                    deckGame.trumpSuit && (
                      <div className="locked-trump-panel mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-3">
                        <p className="text-xs font-bold text-emerald-200">
                          {lang === "ge"
                            ? "არჩეული კოზირი"
                            : "Locked main suit"}
                        </p>
                        <p className="mt-1 text-lg font-black text-emerald-300">
                          {suitName(deckGame.trumpSuit, lang)}
                        </p>
                      </div>
                    )}

                  {seatId === chooser.id &&
                    deckGame.removedCards?.length > 0 && (
                      <div className="removed-cards-panel mt-4 rounded-2xl bg-slate-900/80 p-3">
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

            {showPhoneModePopup &&
              createPortal(
                (
              <div className="phone-choice-overlay" role="dialog" aria-modal="true">
                <div className="phone-choice-card">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                        {ui.chooser}: {chooser.name}
                      </p>
                      <h2 className="mt-1 text-2xl font-black text-amber-200">
                        {ui.chooseMode}
                      </h2>
                    </div>
                    {currentContract && (
                      <p className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">
                        {currentContract.name}
                      </p>
                    )}
                  </div>

                  {myHand.length > 0 && (
                    <div
                      className="choice-hand-preview"
                      style={{
                        "--choice-hand-count": myHand.length,
                        "--choice-hand-max-width": `${myHand.length * 76}px`,
                      }}
                      aria-label={`${myHand.length} ${ui.cards}`}
                    >
                      {myHand.map((card) => (
                        <img
                          key={card.code}
                          src={card.image}
                          alt={card.code}
                          className="choice-hand-card"
                        />
                      ))}
                    </div>
                  )}

                  <div className="phone-mode-list">
                    {contracts.map((contract) => {
                      const used = (usedContracts[chooser.id] || []).includes(
                        contract.id,
                      );
                      const selected = currentContract?.id === contract.id;
                      const canChoose = !used;

                      return (
                        <button
                          key={contract.id}
                          disabled={!canChoose}
                          onClick={() => chooseContract(contract)}
                          className={classNames(
                            "phone-mode-option",
                            selected
                              ? "border-amber-300 bg-amber-300 text-slate-950"
                              : "border-white/10 bg-slate-900 text-slate-100",
                            used && "cursor-not-allowed opacity-35",
                          )}
                        >
                          <span className="font-black">{contract.name}</span>
                          <span className="text-xs opacity-70">
                            {used ? ui.alreadyUsed : contract.scoringText}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {currentContract?.id === "tricks-positive" && (
                    <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3">
                      <p className="text-xs font-black uppercase tracking-widest text-amber-200">
                        {lang === "ge" ? "კოზირი" : "Main suit"}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {TRUMP_OPTIONS.map((suit) => {
                          const active = deckGame.trumpSuit === suit.id;

                          return (
                            <button
                              key={suit.id}
                              type="button"
                              onClick={() => chooseTrumpSuit(suit.id)}
                              className={classNames(
                                "min-h-[42px] rounded-xl border px-3 text-left text-sm font-black transition",
                                active
                                  ? "border-amber-300 bg-amber-300 text-slate-950"
                                  : "border-white/10 bg-slate-950 text-slate-100",
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
                              {lang === "ge" ? suit.nameGe : suit.nameEn}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={confirmMode}
                    disabled={!canConfirmMode}
                    className="mt-3 min-h-[50px] w-full rounded-2xl bg-amber-300 px-4 text-lg font-black text-slate-950 disabled:opacity-50"
                  >
                    {lang === "ge" ? "რეჟიმის დადასტურება" : "Confirm mode"}
                  </button>
                </div>
              </div>
                ),
                document.body,
              )}

            {showPhoneRemoveDock &&
              createPortal(
                (
              <div className="phone-remove-dock">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-200">
                    {ui.remove2}
                  </p>
                  <p className="text-sm font-black text-slate-100">
                    {ui.choose2} ({selectedRemoveCount}/2)
                  </p>
                </div>
                <button
                  onClick={removeSelectedCards}
                  disabled={selectedRemoveCount !== 2}
                  className="min-h-[44px] rounded-2xl bg-amber-300 px-5 font-black text-slate-950 disabled:opacity-50"
                >
                  {ui.remove2}
                </button>
              </div>
                ),
                document.body,
              )}
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

  return (
    <Routes>
      <Route path="/" element={<Navigate to={activeRoomPath} replace />} />
      <Route path="/auth" element={<Navigate to={activeRoomPath} replace />} />
      <Route path="/room" element={<Navigate to={activeRoomPath} replace />} />
      <Route
        path="/lobby"
        element={
          gameStatus === "playing" ? (
            <Navigate to="/game" replace />
          ) : (
            roomSessionPage
          )
        }
      />
      <Route
        path="/game"
        element={
          gameStatus !== "playing" ? (
            <Navigate to="/lobby" replace />
          ) : (
            roomSessionPage
          )
        }
      />
      <Route
        path="/rules"
        element={<RulesPage backTo={activeRoomPath} lang={lang} />}
      />
      <Route path="*" element={<Navigate to={activeRoomPath} replace />} />
    </Routes>
  );
}
