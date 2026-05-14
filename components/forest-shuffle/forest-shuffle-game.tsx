"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { SAMPLE_CARD_LIBRARY } from "@/lib/forest-shuffle/cards";
import {
  createNewGame,
  drawCards,
  getCardDef,
  getDwellerFace,
  getLibraryFromState,
  getMaxDrawCount,
  getPlayedTreeSlots,
  getTreeCost,
  getTreeSlots,
  getVisibleFace,
  playDweller,
  playSapling,
  playTree,
  scoreGame,
  sideLabel,
} from "@/lib/forest-shuffle/engine";
import type {
  RoomGameAction,
  RoomServerMessage,
  ViewerSeat,
} from "@/lib/forest-shuffle/room";
import type {
  CardDefinition,
  DeckDefinition,
  DrawSource,
  GameState,
  PlayedTree,
  PlayEffect,
  PlayerId,
  ScoreRule,
  Side,
} from "@/lib/forest-shuffle/types";

const STORAGE_KEY = "forest-shuffle-private-table-v3";
const TOKEN_KEY = "forest-shuffle-client-token-v1";
const DEFAULT_ROOM_PORT = "8787";
const PUBLIC_ROOM_WS_URL =
  process.env.NEXT_PUBLIC_FOREST_ROOM_WS_URL?.trim() ||
  "wss://8-218-149-148.anyip.dev/forest-shuffle-room/ws";

interface ConnectionState {
  status: "offline" | "connecting" | "connected";
  roomId: string;
  viewerSeat: ViewerSeat;
  error: string | null;
}

export function ForestShuffleGame() {
  const socketRef = useRef<WebSocket | null>(null);
  const [game, setGame] = useState<GameState>(() =>
    createNewGame(SAMPLE_CARD_LIBRARY, {
      seed: "private-table-initial",
      playerNames: ["你", "朋友"],
    }),
  );
  const [connection, setConnection] = useState<ConnectionState>({
    status: "offline",
    roomId: "",
    viewerSeat: "spectator",
    error: null,
  });
  const [playerName, setPlayerName] = useState("你");
  const [preferredSeat, setPreferredSeat] = useState<PlayerId>(0);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [serverPort, setServerPort] = useState(DEFAULT_ROOM_PORT);
  const [pageOrigin, setPageOrigin] = useState("");
  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const [selectedTreeUid, setSelectedTreeUid] = useState<string | null>(null);
  const [paymentUids, setPaymentUids] = useState<string[]>([]);
  const [drawSources, setDrawSources] = useState<DrawSource[]>([]);
  const [libraryText, setLibraryText] = useState("");
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [hideHand, setHideHand] = useState(false);
  const [turnNotice, setTurnNotice] = useState<string | null>(null);
  const lastTurnNoticeKeyRef = useRef<string | null>(null);
  const turnNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = useCallback((message: string, duration = 2400) => {
    setTurnNotice(message);

    if (turnNoticeTimerRef.current) {
      clearTimeout(turnNoticeTimerRef.current);
    }

    turnNoticeTimerRef.current = setTimeout(() => {
      setTurnNotice(null);
    }, duration);
  }, []);

  const isConnected = connection.status === "connected";
  const isConnecting = connection.status === "connecting";
  const viewerSeat = connection.viewerSeat;
  const isSeated = viewerSeat === 0 || viewerSeat === 1;
  const tablePlayerId: PlayerId = isSeated ? viewerSeat : game.currentPlayer;
  const tablePlayer = game.players[tablePlayerId];
  const activePlayer = game.players[game.currentPlayer];
  const canAct =
    game.status === "playing" && (!isConnected || connection.viewerSeat === game.currentPlayer);
  const handHidden = hideHand || (isConnected && !isSeated);
  const selectedDefinition = selectedCardUid ? getCardDef(game, selectedCardUid) : null;
  const selectedFace =
    selectedDefinition?.kind === "dweller" && selectedFaceId
      ? getDwellerFace(selectedDefinition, selectedFaceId)
      : null;
  const scores = useMemo(() => scoreGame(game), [game]);
  const maxDrawCount = canAct ? getMaxDrawCount(game, game.currentPlayer) : 0;
  const inviteUrl =
    pageOrigin && connection.roomId
      ? `${pageOrigin}/forest-shuffle/?room=${connection.roomId}`
      : "";
  const usesManagedRoomServer = pageOrigin
    ? !isPrivateRoomHost(new URL(pageOrigin).hostname)
    : false;
  const revealedWinter = game.revealedWinter ?? [];
  const discardPile = game.discardPile ?? [];

  useEffect(() => {
    setPageOrigin(window.location.origin);

    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room");
    const seat = params.get("seat");

    if (roomId) {
      setRoomIdInput(roomId.toUpperCase());
    }

    if (seat === "1") {
      setPreferredSeat(1);
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved || roomId) {
      return;
    }

    try {
      setGame(JSON.parse(saved) as GameState);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!isConnected) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    }
  }, [game, isConnected]);

  useEffect(() => {
    clearSelections();
  }, [game.turn, game.status]);

  useEffect(() => {
    const turnKey = `${game.turn}:${game.currentPlayer}:${game.status}`;

    if (lastTurnNoticeKeyRef.current === null) {
      lastTurnNoticeKeyRef.current = turnKey;
      return;
    }

    if (lastTurnNoticeKeyRef.current === turnKey || game.status !== "playing") {
      lastTurnNoticeKeyRef.current = turnKey;
      return;
    }

    lastTurnNoticeKeyRef.current = turnKey;
    const notice =
      isConnected && connection.viewerSeat === game.currentPlayer
        ? "轮到你了"
        : `轮到 ${activePlayer.name} 了`;
    showNotice(notice);
  }, [
    activePlayer.name,
    connection.viewerSeat,
    game.currentPlayer,
    game.status,
    game.turn,
    isConnected,
    showNotice,
  ]);

  useEffect(() => {
    return () => {
      if (turnNoticeTimerRef.current) {
        clearTimeout(turnNoticeTimerRef.current);
      }
      socketRef.current?.close();
    };
  }, []);

  function clearSelections() {
    setSelectedCardUid(null);
    setSelectedFaceId(null);
    setSelectedTreeUid(null);
    setPaymentUids([]);
    setDrawSources([]);
    setHideHand(false);
  }

  function connectToRoom(mode: "create" | "join") {
    const token = getClientToken();
    const roomId = roomIdInput.trim().toUpperCase();

    if (mode === "join" && !roomId) {
      setConnection((current) => ({
        ...current,
        error: "请输入房间号。",
      }));
      return;
    }

    socketRef.current?.close();
    const socket = new WebSocket(getWebSocketUrl(serverPort));
    socketRef.current = socket;

    setConnection({
      status: "connecting",
      roomId: mode === "join" ? roomId : "",
      viewerSeat: "spectator",
      error: null,
    });

    socket.onopen = () => {
      socket.send(
        JSON.stringify(
          mode === "create"
            ? {
                type: "create-room",
                token,
                name: playerName,
                seat: preferredSeat,
                library: getLibraryFromState(game),
              }
            : {
                type: "join-room",
                token,
                roomId,
                name: playerName,
                seat: preferredSeat,
              },
        ),
      );
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as RoomServerMessage;

      if (message.type === "snapshot") {
        setGame(message.snapshot.game);
        setRoomIdInput(message.snapshot.roomId);
        if (message.snapshot.viewerSeat === 0 || message.snapshot.viewerSeat === 1) {
          setPlayerName(seatLabel(message.snapshot.viewerSeat));
        }
        setConnection({
          status: "connected",
          roomId: message.snapshot.roomId,
          viewerSeat: message.snapshot.viewerSeat,
          error: null,
        });
        updateRoomUrl(message.snapshot.roomId, message.snapshot.viewerSeat);
        return;
      }

      if (message.type === "notice") {
        showNotice(message.message, 3000);
        return;
      }

      if (message.type === "error") {
        setConnection((current) => ({
          ...current,
          status: current.status === "connecting" ? "offline" : current.status,
          error: message.message,
        }));
      }
    };

    socket.onerror = () => {
      setConnection((current) => ({
        ...current,
        status: "offline",
        error: getRoomConnectionError(serverPort),
      }));
    };

    socket.onclose = () => {
      if (socketRef.current === socket) {
        setConnection((current) => ({
          ...current,
          status: "offline",
          error: current.error,
        }));
      }
    };
  }

  function disconnectRoom() {
    socketRef.current?.close();
    socketRef.current = null;
    setConnection({
      status: "offline",
      roomId: "",
      viewerSeat: "spectator",
      error: null,
    });
  }

  function claimSeat(seat: PlayerId) {
    sendRoomMessage({
      type: "claim-seat",
      token: getClientToken(),
      roomId: connection.roomId,
      name: playerName,
      seat,
    });
  }

  function sendAction(action: RoomGameAction) {
    if (isConnected) {
      sendRoomMessage({
        type: "action",
        token: getClientToken(),
        roomId: connection.roomId,
        action,
      });
      return;
    }

    if (action.type === "draw") {
      setGame((current) => drawCards(current, action.sources));
    } else if (action.type === "play-tree") {
      setGame((current) => playTree(current, action.cardUid, action.paymentUids));
    } else if (action.type === "play-sapling") {
      setGame((current) => playSapling(current, action.cardUid));
    } else if (action.type === "play-dweller") {
      setGame((current) =>
        playDweller(current, {
          cardUid: action.cardUid,
          faceId: action.faceId,
          treeUid: action.treeUid,
          paymentUids: action.paymentUids,
        }),
      );
    } else if (action.type === "new-game") {
      startLocalGame(action.library);
    }
  }

  function sendRoomMessage(message: object) {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setConnection((current) => ({
        ...current,
        error: "房间连接已断开。",
      }));
      return;
    }

    socket.send(JSON.stringify(message));
  }

  function startNewGame(library = getLibraryFromState(game)) {
    if (isConnected) {
      sendAction({ type: "new-game", library });
      clearSelections();
      return;
    }

    startLocalGame(library);
  }

  function startLocalGame(library = getLibraryFromState(game)) {
    const next = createNewGame(library, {
      seed: String(Date.now()),
      playerNames: [game.players[0].name, game.players[1].name],
    });
    setGame(next);
    clearSelections();
  }

  function chooseHandCard(uid: string) {
    if (handHidden || !canAct) {
      return;
    }

    setDrawSources([]);
    setSelectedCardUid(uid);
    setPaymentUids([]);
    setSelectedTreeUid(null);

    const definition = getCardDef(game, uid);
    if (definition.kind === "dweller") {
      setSelectedFaceId(definition.faces[0].id);
    } else {
      setSelectedFaceId(null);
    }
  }

  function togglePayment(uid: string) {
    if (!selectedDefinition || uid === selectedCardUid || !canAct) {
      return;
    }

    const selectedCost =
      selectedDefinition.kind === "tree"
        ? getTreeCost(selectedDefinition)
        : selectedFace?.cost;

    if (selectedCost === undefined) {
      return;
    }

    setPaymentUids((current) => {
      if (current.includes(uid)) {
        return current.filter((item) => item !== uid);
      }

      if (current.length >= selectedCost) {
        return current;
      }

      return [...current, uid];
    });
  }

  function addDrawSource(source: DrawSource) {
    if (!canAct || drawSources.length >= maxDrawCount) {
      return;
    }

    if (
      source.type === "clearing" &&
      drawSources.some((item) => item.type === "clearing" && item.uid === source.uid)
    ) {
      return;
    }

    setSelectedCardUid(null);
    setSelectedFaceId(null);
    setSelectedTreeUid(null);
    setPaymentUids([]);
    setDrawSources((current) => [...current, source]);
  }

  function confirmDraw() {
    if (!canAct || drawSources.length === 0) {
      return;
    }

    sendAction({ type: "draw", playerId: game.currentPlayer, sources: drawSources });
    clearSelections();
  }

  function confirmSapling() {
    if (!selectedCardUid || !canAct) {
      return;
    }

    sendAction({
      type: "play-sapling",
      playerId: game.currentPlayer,
      cardUid: selectedCardUid,
    });
    clearSelections();
  }

  function confirmPlay() {
    if (!selectedCardUid || !canAct) {
      return;
    }

    if (selectedDefinition?.kind === "tree") {
      sendAction({
        type: "play-tree",
        playerId: game.currentPlayer,
        cardUid: selectedCardUid,
        paymentUids,
      });
      clearSelections();
      return;
    }

    if (selectedDefinition?.kind === "dweller" && selectedFace && selectedTreeUid) {
      sendAction({
        type: "play-dweller",
        playerId: game.currentPlayer,
        cardUid: selectedCardUid,
        faceId: selectedFace.id,
        treeUid: selectedTreeUid,
        paymentUids,
      });
      clearSelections();
    }
  }

  function exportLibrary() {
    setLibraryText(JSON.stringify(getLibraryFromState(game), null, 2));
    setLibraryError(null);
  }

  function importLibrary() {
    try {
      const parsed = JSON.parse(libraryText) as DeckDefinition[];

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("牌库必须是非空数组。");
      }

      startNewGame(parsed);
      setLibraryError(null);
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "牌库 JSON 无法解析。");
    }
  }

  return (
    <main className="space-y-6">
      {turnNotice ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-8 z-50 flex justify-center px-4"
        >
          <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg border border-emerald-800/20 bg-white px-5 py-4 text-slate-950 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.55)]">
            <span className="h-3 w-3 rounded-full bg-emerald-700" />
            <p className="text-base font-semibold">{turnNotice}</p>
            <button
              type="button"
              className="ml-2 rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              onClick={() => setTurnNotice(null)}
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-slate-900/10 bg-white/80 p-4 shadow-[0_24px_80px_-64px_rgba(15,23,42,0.7)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-800">
            Online Room Table
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            森森不息
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-700">
            <StatusPill label={`第 ${game.turn} 回合`} />
            <StatusPill label={`当前：${activePlayer.name}`} />
            <StatusPill label={`你的座位：${seatLabel(connection.viewerSeat)}`} />
            <StatusPill label={`牌堆 ${game.deck.length}`} />
            <StatusPill label={`冬季 ${game.winterCount}/3`} />
            <StatusPill label={`空地 ${game.clearing.length}`} />
            <StatusPill label={`移除 ${discardPile.length}`} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-emerald-700 hover:text-emerald-800"
            onClick={() => setHideHand((value) => !value)}
          >
            {hideHand ? "显示手牌" : "遮挡手牌"}
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
            onClick={() => startNewGame()}
          >
            新开一局
          </button>
        </div>
      </section>

      <Panel title="线上房间">
        <div className="grid gap-3 lg:grid-cols-[minmax(10rem,0.8fr)_minmax(8rem,0.45fr)_minmax(8rem,0.45fr)_minmax(10rem,0.6fr)_auto] lg:items-end">
          <Field label="名字">
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
            />
          </Field>
          <Field label="座位">
            <div className="grid grid-cols-2 overflow-hidden rounded-md border border-slate-300 bg-white text-sm font-semibold">
              {[0, 1].map((seat) => (
                <button
                  key={seat}
                  type="button"
                  className={[
                    "px-3 py-2 transition",
                    preferredSeat === seat ? "bg-emerald-800 text-white" : "text-slate-700",
                  ].join(" ")}
                  onClick={() => setPreferredSeat(seat as PlayerId)}
                >
                  P{seat + 1}
                </button>
              ))}
            </div>
          </Field>
          {!usesManagedRoomServer ? (
            <Field label="服务端口">
              <input
                value={serverPort}
                onChange={(event) => setServerPort(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
              />
            </Field>
          ) : null}
          <Field label="房间号">
            <input
              value={roomIdInput}
              onChange={(event) => setRoomIdInput(event.target.value.toUpperCase())}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <ActionWithTooltip
              tooltip={
                isConnected
                  ? "创建新的线上房间，会断开当前房间连接并让你成为新房间的玩家一。"
                  : "创建一个线上房间，当前浏览器会入座为所选座位，朋友可用房间号加入。"
              }
            >
              <button
                type="button"
                className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={() => connectToRoom("create")}
                disabled={isConnecting}
              >
                创建
              </button>
            </ActionWithTooltip>
            <ActionWithTooltip
              tooltip={
                isConnected
                  ? "你已经加入当前房间。如需加入其他房间，请先断开或直接创建新房间。"
                  : "输入房间号后加入线上房间，加入成功后会固定显示为玩家一或玩家二。"
              }
            >
              <button
                type="button"
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={() => connectToRoom("join")}
                disabled={isConnecting || isConnected}
              >
                {isConnected ? "已加入" : isConnecting ? "加入中" : "加入"}
              </button>
            </ActionWithTooltip>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex flex-wrap gap-2 text-sm text-slate-700">
            <StatusPill label={`连接：${connectionStatusLabel(connection.status)}`} />
            {connection.roomId ? <StatusPill label={`房间：${connection.roomId}`} /> : null}
            {connection.roomId ? (
              <>
                <SeatButton seat={0} connection={connection} onClaim={() => claimSeat(0)} />
                <SeatButton seat={1} connection={connection} onClaim={() => claimSeat(1)} />
              </>
            ) : null}
          </div>
          <ActionWithTooltip
            tooltip={
              isConnected || isConnecting
                ? "断开当前浏览器和房间同步服务的连接；房间服务仍会继续运行。"
                : "当前没有连接房间。"
            }
          >
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-emerald-700 disabled:cursor-not-allowed disabled:text-slate-400"
              onClick={disconnectRoom}
              disabled={!isConnected && !isConnecting}
            >
              断开
            </button>
          </ActionWithTooltip>
        </div>

        {inviteUrl ? (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700">
            {inviteUrl}
          </div>
        ) : null}
        {connection.error ? (
          <p className="mt-3 text-sm font-medium text-red-700">{connection.error}</p>
        ) : null}
      </Panel>

      {!canAct && game.status === "playing" ? (
        <section className="rounded-lg border border-slate-900/10 bg-slate-50 p-4 text-sm font-medium text-slate-700">
          等待 {activePlayer.name} 操作。
        </section>
      ) : null}

      {game.status === "finished" ? (
        <section className="rounded-lg border border-emerald-900/20 bg-emerald-50 p-4">
          <h2 className="text-xl font-semibold text-emerald-950">
            {game.winner === "tie" ? "平局" : `${game.players[game.winner ?? 0].name} 获胜`}
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {scores.map((score) => (
              <ScorePanel key={score.player} game={game} score={score} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="space-y-4">
          <Panel title="抽牌">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                  onClick={() => addDrawSource({ type: "deck" })}
                  disabled={!canAct || drawSources.length >= maxDrawCount}
                >
                  摸牌
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-emerald-700 disabled:cursor-not-allowed disabled:text-slate-400"
                  onClick={() => setDrawSources([])}
                  disabled={drawSources.length === 0}
                >
                  清空
                </button>
                <button
                  type="button"
                  className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
                  onClick={confirmDraw}
                  disabled={!canAct || drawSources.length === 0}
                >
                  确认抽牌
                </button>
              </div>
              <p className="text-sm text-slate-600">
                已选 {drawSources.length}/{maxDrawCount}：
                {drawSources.length === 0
                  ? "等待选择"
                  : drawSources
                      .map((source) =>
                        source.type === "deck" ? "牌堆" : getCardDef(game, source.uid).title,
                      )
                      .join("、")}
              </p>
            </div>
          </Panel>

          <Panel title="空地">
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="font-semibold text-slate-900">冬季区</p>
                  <span className="text-slate-500">{revealedWinter.length}/3</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {revealedWinter.length === 0 ? (
                    <p className="col-span-full text-sm text-slate-500">冬季尚未出现</p>
                  ) : (
                    revealedWinter.map((uid) => (
                      <ZoneCardTile key={uid} definition={getCardDef(game, uid)} />
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>空地达到 10 张会在回合结束时清走。</span>
                <span>已移除 {discardPile.length} 张</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {game.clearing.length === 0 ? (
                  <ZoneEmpty label="空地暂无牌" />
                ) : (
                  game.clearing.map((uid) => (
                    <button
                      key={uid}
                      type="button"
                      className="h-full text-left"
                      onClick={() => addDrawSource({ type: "clearing", uid })}
                      disabled={!canAct || drawSources.length >= maxDrawCount}
                    >
                      <ZoneCardTile
                        definition={getCardDef(game, uid)}
                        selected={drawSources.some(
                          (source) => source.type === "clearing" && source.uid === uid,
                        )}
                      />
                    </button>
                  ))
                )}
              </div>
            </div>
          </Panel>

          <Panel title="洞穴">
            <div className="space-y-3">
              {game.players.map((player, index) => (
                <div
                  key={`cave-${index}`}
                  className="rounded-md border border-slate-200 bg-white/70 p-3"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <p className="font-semibold text-slate-900">{player.name}</p>
                    <span className="text-slate-500">{player.cave.length} 张</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {player.cave.length === 0 ? (
                      <ZoneEmpty label="洞穴为空" />
                    ) : (
                      player.cave.map((uid) => (
                        <ZoneCardTile key={uid} definition={getCardDef(game, uid)} />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="计分">
            <div className="grid gap-3">
              {scores.map((score) => (
                <ScorePanel key={score.player} game={game} score={score} compact />
              ))}
            </div>
          </Panel>

          <Panel title="记录">
            <ol className="max-h-72 space-y-2 overflow-auto text-sm text-slate-700">
              {game.log.slice(0, 18).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={`${tablePlayer.name} 手牌`}>
            {handHidden ? (
              <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-600">
                手牌已遮挡
              </div>
            ) : (
              <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {tablePlayer.hand.map((uid) => (
                  <button
                    key={uid}
                    type="button"
                    className="h-full text-left"
                    onClick={() => chooseHandCard(uid)}
                    disabled={!canAct}
                  >
                    <CardTile
                      definition={getCardDef(game, uid)}
                      selected={selectedCardUid === uid}
                      paymentSelected={paymentUids.includes(uid)}
                    />
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <section className="grid gap-4 xl:grid-cols-[minmax(26rem,0.95fr)_minmax(0,1.05fr)]">
            <Panel title="出牌">
              <PlayControls
                game={game}
                playerId={tablePlayerId}
                disabled={!canAct}
                selectedDefinition={selectedDefinition}
                selectedCardUid={selectedCardUid}
                selectedFaceId={selectedFaceId}
                selectedTreeUid={selectedTreeUid}
                selectedFaceCost={selectedFace?.cost ?? 0}
                paymentCount={paymentUids.length}
                paymentUids={paymentUids}
                onSelectFace={(faceId) => {
                  setSelectedFaceId(faceId);
                  setSelectedTreeUid(null);
                  setPaymentUids([]);
                }}
                onSelectTree={setSelectedTreeUid}
                onTogglePayment={togglePayment}
                onConfirm={confirmPlay}
                onConfirmSapling={confirmSapling}
              />
            </Panel>

            <Panel title={`${tablePlayer.name} 森林`}>
              <div className="grid gap-3 md:grid-cols-2">
                {tablePlayer.forest.length === 0 ? (
                  <p className="text-sm text-slate-600">还没有树木或树苗。</p>
                ) : (
                  tablePlayer.forest.map((tree) => (
                    <TreeView
                      key={tree.uid}
                      game={game}
                      tree={tree}
                      selected={selectedTreeUid === tree.uid}
                      activeSide={selectedFace?.side}
                      readonly={!canAct}
                      onSelect={() => setSelectedTreeUid(tree.uid)}
                    />
                  ))
                )}
              </div>
            </Panel>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {game.players.map((player, index) => (
              <Panel key={`player-summary-${index}`} title={player.name}>
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    手牌 {player.hand.length} 张，森林 {player.forest.length} 棵，洞穴{" "}
                    {player.cave.length} 张。
                  </p>
                  {index !== tablePlayerId ? (
                    <div className="grid gap-2">
                      {player.forest.map((tree) => (
                        <TreeView key={tree.uid} game={game} tree={tree} readonly />
                      ))}
                    </div>
                  ) : null}
                </div>
              </Panel>
            ))}
          </section>
        </div>
      </section>

      <details className="rounded-lg border border-slate-900/10 bg-white/75 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          本地牌库
        </summary>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-emerald-700"
              onClick={exportLibrary}
            >
              导出当前牌库
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              onClick={importLibrary}
            >
              用此牌库开局
            </button>
          </div>
          <textarea
            className="min-h-72 w-full resize-y rounded-md border border-slate-300 bg-white p-3 font-mono text-xs leading-5 text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
            value={libraryText}
            onChange={(event) => setLibraryText(event.target.value)}
            spellCheck={false}
          />
          {libraryError ? <p className="text-sm text-red-700">{libraryError}</p> : null}
        </div>
      </details>
    </main>
  );
}

function PlayControls({
  game,
  playerId,
  disabled,
  selectedDefinition,
  selectedCardUid,
  selectedFaceId,
  selectedTreeUid,
  selectedFaceCost,
  paymentCount,
  paymentUids,
  onSelectFace,
  onSelectTree,
  onTogglePayment,
  onConfirm,
  onConfirmSapling,
}: {
  game: GameState;
  playerId: PlayerId;
  disabled: boolean;
  selectedDefinition: CardDefinition | null;
  selectedCardUid: string | null;
  selectedFaceId: string | null;
  selectedTreeUid: string | null;
  selectedFaceCost: number;
  paymentCount: number;
  paymentUids: string[];
  onSelectFace: (faceId: string) => void;
  onSelectTree: (treeUid: string) => void;
  onTogglePayment: (uid: string) => void;
  onConfirm: () => void;
  onConfirmSapling: () => void;
}) {
  const player = game.players[playerId];
  const selectedTreeCost =
    selectedDefinition?.kind === "tree" ? getTreeCost(selectedDefinition) : 0;
  const canConfirmTree =
    !disabled && selectedDefinition?.kind === "tree" && paymentCount === selectedTreeCost;
  const canConfirmDweller =
    !disabled &&
    selectedDefinition?.kind === "dweller" &&
    selectedFaceId &&
    selectedTreeUid &&
    selectedFaceCost === paymentCount;
  const canConfirmSapling =
    !disabled && Boolean(selectedCardUid) && selectedDefinition?.kind !== "winter";

  if (disabled) {
    return <p className="text-sm text-slate-600">等待当前玩家操作。</p>;
  }

  if (!selectedDefinition) {
    return <p className="text-sm text-slate-600">选择一张手牌。</p>;
  }

  if (selectedDefinition.kind === "tree") {
    return (
      <div className="space-y-3">
        <CardTile definition={selectedDefinition} compact />
        <button
          type="button"
          className="w-full rounded-md border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
          disabled={!canConfirmSapling}
          onClick={onConfirmSapling}
        >
          作为树苗打出
        </button>
        <PaymentPicker
          game={game}
          player={player}
          selectedCardUid={selectedCardUid}
          paymentUids={paymentUids}
          paymentCount={paymentCount}
          requiredCost={selectedTreeCost}
          onTogglePayment={onTogglePayment}
        />
        <button
          type="button"
          className="w-full rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canConfirmTree}
          onClick={onConfirm}
        >
          种下树木
        </button>
      </div>
    );
  }

  if (selectedDefinition.kind !== "dweller") {
    return null;
  }

  const selectedFace = selectedFaceId
    ? getDwellerFace(selectedDefinition, selectedFaceId)
    : selectedDefinition.faces[0];

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="w-full rounded-md border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
        disabled={!canConfirmSapling}
        onClick={onConfirmSapling}
      >
        作为树苗打出
      </button>

      <div className="grid gap-2">
        {selectedDefinition.faces.map((face) => (
          <button
            key={face.id}
            type="button"
            className={[
              "rounded-md border px-3 py-2 text-left text-sm transition",
              selectedFaceId === face.id
                ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                : "border-slate-300 bg-white text-slate-800 hover:border-emerald-700",
            ].join(" ")}
            onClick={() => onSelectFace(face.id)}
          >
            <span className="font-semibold">{face.title}</span>
            <span className="ml-2 text-slate-500">
              {sideLabel(face.side)} / 费用 {face.cost}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-900">目标树木</p>
        <div className="grid gap-2">
          {player.forest.map((tree) => {
            const definition = getCardDef(game, tree.uid);
            const title =
              tree.isSapling || definition.kind !== "tree" ? "树苗" : definition.title;
            const hasSlot = getPlayedTreeSlots(game, tree).includes(selectedFace.side);
            const occupied = Boolean(tree.attached[selectedFace.side]);
            const blocked = !hasSlot || occupied;

            return (
              <button
                key={tree.uid}
                type="button"
                className={[
                  "rounded-md border px-3 py-2 text-left text-sm transition",
                  selectedTreeUid === tree.uid
                    ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                    : "border-slate-300 bg-white text-slate-800 hover:border-emerald-700",
                  blocked ? "cursor-not-allowed opacity-45" : "",
                ].join(" ")}
                onClick={() => {
                  if (!blocked) {
                    onSelectTree(tree.uid);
                  }
                }}
                disabled={blocked}
              >
                {title}：{sideLabel(selectedFace.side)}
                {!hasSlot ? "无此位置" : occupied ? "已占用" : "可放置"}
              </button>
            );
          })}
        </div>
      </div>

      <PaymentPicker
        game={game}
        player={player}
        selectedCardUid={selectedCardUid}
        paymentUids={paymentUids}
        paymentCount={paymentCount}
        requiredCost={selectedFace.cost}
        onTogglePayment={onTogglePayment}
      />

      <button
        type="button"
        className="w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={!canConfirmDweller}
        onClick={onConfirm}
      >
        放置住民
      </button>
    </div>
  );
}

function PaymentPicker({
  game,
  player,
  selectedCardUid,
  paymentUids,
  paymentCount,
  requiredCost,
  onTogglePayment,
}: {
  game: GameState;
  player: GameState["players"][number];
  selectedCardUid: string | null;
  paymentUids: string[];
  paymentCount: number;
  requiredCost: number;
  onTogglePayment: (uid: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-900">
        支付 {paymentCount}/{requiredCost}
      </p>
      {requiredCost === 0 ? (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          这张牌无需支付。
        </p>
      ) : (
        <div className="grid max-h-72 grid-cols-1 gap-2 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
          {player.hand
            .filter((uid) => uid !== selectedCardUid)
            .map((uid) => (
              <button
                key={uid}
                type="button"
                className="text-left"
                onClick={() => onTogglePayment(uid)}
              >
                <PaymentCardOption
                  definition={getCardDef(game, uid)}
                  selected={paymentUids.includes(uid)}
                />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function PaymentCardOption({
  definition,
  selected,
}: {
  definition: CardDefinition;
  selected: boolean;
}) {
  const kindLabel =
    definition.kind === "tree" ? "树" : definition.kind === "dweller" ? "住民" : "冬";

  return (
    <div
      className={[
        "rounded-md border bg-white p-3 transition",
        selected
          ? "border-amber-500 bg-amber-50 ring-2 ring-amber-200"
          : "border-slate-200 hover:border-emerald-700",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold leading-5 text-slate-950">{definition.title}</h4>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
          {kindLabel}
        </span>
      </div>

      {definition.kind === "tree" ? (
        <p className="mt-2 text-xs leading-5 text-slate-600">
          {definition.species} / 费 {getTreeCost(definition)} / {definition.basePoints} 分
        </p>
      ) : null}

      {definition.kind === "dweller" ? (
        <div className="mt-2 space-y-2">
          {definition.faces.map((face) => (
            <div key={face.id} className="space-y-1">
              <p className="text-xs font-semibold leading-4 text-slate-800">
                {face.title} / {sideLabel(face.side)} / 费 {face.cost} / {face.basePoints} 分
              </p>
              <TagList tags={face.tags} dense />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ZoneCardTile({
  definition,
  selected = false,
}: {
  definition: CardDefinition;
  selected?: boolean;
}) {
  const kindLabel =
    definition.kind === "tree" ? "树" : definition.kind === "dweller" ? "住民" : "冬";
  const kindClass =
    definition.kind === "tree"
      ? "border-emerald-700/30 bg-emerald-50/80"
      : definition.kind === "dweller"
        ? "border-amber-700/30 bg-amber-50/80"
        : "border-slate-600/30 bg-slate-100";

  return (
    <article
      className={[
        "min-h-32 rounded-lg border p-3 text-left shadow-sm transition",
        kindClass,
        selected ? "ring-4 ring-emerald-200" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-5 text-slate-950">{definition.title}</h3>
        <span className="shrink-0 rounded-md bg-white/75 px-2 py-1 text-[11px] font-semibold text-slate-600">
          {kindLabel}
        </span>
      </div>

      {definition.kind === "tree" ? (
        <p className="mt-3 text-xs leading-5 text-slate-700">
          {definition.species} / 费 {getTreeCost(definition)} / {definition.basePoints} 分
        </p>
      ) : null}

      {definition.kind === "dweller" ? (
        <div className="mt-3 space-y-2">
          {definition.faces.map((face) => (
            <div key={face.id} className="space-y-1 rounded-md bg-white/65 p-2">
              <p className="text-xs font-semibold leading-4 text-slate-900">{face.title}</p>
              <p className="text-xs leading-4 text-slate-600">
                {sideLabel(face.side)} / 费 {face.cost} / {face.basePoints} 分
              </p>
              <TagList tags={face.tags} dense />
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function TreeView({
  game,
  tree,
  selected = false,
  activeSide,
  readonly = false,
  onSelect,
}: {
  game: GameState;
  tree: PlayedTree;
  selected?: boolean;
  activeSide?: Side;
  readonly?: boolean;
  onSelect?: () => void;
}) {
  const definition = getCardDef(game, tree.uid);
  const treeDefinition = !tree.isSapling && definition.kind === "tree" ? definition : null;
  const slots = treeDefinition ? getTreeSlots(treeDefinition) : getPlayedTreeSlots(game, tree);
  const title = treeDefinition ? treeDefinition.title : "树苗";
  const subtitle = treeDefinition ? treeDefinition.species : "任意手牌倒扣形成";
  const points = treeDefinition ? treeDefinition.basePoints : 0;
  const scoreDetails = getForestScoreDetails(game, tree, title, points, treeDefinition);

  return (
    <button
      type="button"
      title={scoreDetails.join("\n")}
      className={[
        "group relative w-full rounded-lg border bg-white p-3 text-left transition",
        selected ? "border-emerald-700 ring-4 ring-emerald-100" : "border-slate-200",
        readonly ? "cursor-default" : "hover:border-emerald-700",
      ].join(" ")}
      onClick={readonly ? undefined : onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
          {points} 分
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {slots.map((side) => {
          const dweller = tree.attached[side];
          const face = dweller ? getVisibleFace(game, dweller) : null;
          const occupied = Boolean(face);

          return (
            <div
              key={side}
              className={[
                "min-h-16 rounded-md border p-2 text-xs",
                occupied
                  ? "border-emerald-500 bg-emerald-50"
                  : activeSide === side
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-slate-200 bg-slate-50",
              ].join(" ")}
            >
              <p className={["font-semibold", occupied ? "text-emerald-900" : "text-slate-700"].join(" ")}>
                {sideLabel(side)}
              </p>
              <p className={["mt-1", occupied ? "font-semibold text-emerald-800" : "text-slate-600"].join(" ")}>
                {face ? face.title : "空位"}
              </p>
            </div>
          );
        })}
      </div>
      {scoreDetails.length > 0 ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-80 rounded-md border border-slate-900/10 bg-slate-950 p-3 text-left text-xs font-normal leading-5 text-white shadow-xl group-hover:block group-focus:block"
        >
          {scoreDetails.map((item) => (
            <span key={item} className="block">
              {item}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

function getForestScoreDetails(
  game: GameState,
  tree: PlayedTree,
  title: string,
  basePoints: number,
  treeDefinition: Extract<CardDefinition, { kind: "tree" }> | null,
): string[] {
  const details = [`${title}：基础 ${basePoints} 分`];

  for (const rule of treeDefinition?.scoreRules ?? []) {
    details.push(`${rule.label ?? describeScoreRule(rule)}：${describeScoreRuleDetail(rule)}`);
  }

  for (const dweller of Object.values(tree.attached)) {
    if (!dweller) {
      continue;
    }

    const face = getVisibleFace(game, dweller);
    details.push(`${face.title}：基础 ${face.basePoints} 分`);

    for (const rule of face.scoreRules ?? []) {
      details.push(`${rule.label ?? describeScoreRule(rule)}：${describeScoreRuleDetail(rule)}`);
    }
  }

  return details;
}

function CardTile({
  definition,
  selected = false,
  paymentSelected = false,
  compact = false,
}: {
  definition: CardDefinition;
  selected?: boolean;
  paymentSelected?: boolean;
  compact?: boolean;
}) {
  const kindClass =
    definition.kind === "tree"
      ? "border-emerald-700/35 bg-emerald-50"
      : definition.kind === "dweller"
        ? "border-amber-700/35 bg-amber-50"
        : "border-slate-600/35 bg-slate-100";
  const sizeClass = compact ? "h-48" : "h-80";

  return (
    <article
      className={[
        "flex w-full flex-col rounded-lg border p-3 shadow-sm transition",
        sizeClass,
        kindClass,
        selected ? "ring-4 ring-emerald-200" : "",
        paymentSelected ? "ring-4 ring-amber-300" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-5 text-slate-950">{definition.title}</h3>
        <span className="rounded-md bg-white/75 px-2 py-1 text-[11px] font-semibold uppercase text-slate-600">
          {definition.kind === "tree" ? "树" : definition.kind === "dweller" ? "住民" : "冬"}
        </span>
      </div>

      {definition.kind === "tree" ? (
        <div className="mt-3 min-h-0 flex-1 space-y-2 text-xs leading-5 text-slate-700">
          <p>
            {definition.species} / 费 {getTreeCost(definition)} / {definition.basePoints} 分
          </p>
          <CardRules rules={definition.scoreRules} effects={definition.onPlay} />
        </div>
      ) : null}

      {definition.kind === "dweller" ? (
        <div className="mt-3 grid min-h-0 flex-1 gap-2">
          {definition.faces.map((face) => (
            <div key={face.id} className="rounded-md bg-white/70 p-2 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">{face.title}</p>
              <TagList tags={face.tags} />
              <p className="mt-1">
                {sideLabel(face.side)} / 费 {face.cost} / {face.basePoints} 分
              </p>
              <CardRules rules={face.scoreRules} effects={face.onPlay} />
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function TagList({ tags, dense = false }: { tags: string[]; dense?: boolean }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={["flex flex-wrap gap-1", dense ? "mt-1" : "mt-1.5"].join(" ")}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={[
            "rounded-md border border-slate-200 bg-white/80 font-medium text-slate-600",
            dense ? "px-1.5 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
          ].join(" ")}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function CardRules({
  rules,
  effects,
}: {
  rules?: ScoreRule[];
  effects?: PlayEffect[];
}) {
  const effectItems = (effects ?? []).map((effect) => ({
    label: describePlayEffect(effect),
    detail: describePlayEffectDetail(effect),
  }));
  const ruleItems = (rules ?? []).map((rule) => ({
    label: describeScoreRule(rule),
    detail: describeScoreRuleDetail(rule),
  }));

  if (effectItems.length === 0 && ruleItems.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1 text-[11px] leading-4 text-slate-600">
      {effectItems.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-semibold text-slate-700">技能</span>
          {effectItems.map((item) => (
            <InfoBadge key={`effect-${item.label}`} label={item.label} detail={item.detail} />
          ))}
        </div>
      ) : null}
      {ruleItems.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-semibold text-slate-700">计分</span>
          {ruleItems.map((item) => (
            <InfoBadge key={`rule-${item.label}`} label={item.label} detail={item.detail} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InfoBadge({ label, detail }: { label: string; detail: string }) {
  return (
    <span
      className="group relative inline-flex max-w-full cursor-help rounded-md border border-slate-200 bg-white/80 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 outline-none focus:border-emerald-700"
      tabIndex={0}
      title={detail}
    >
      <span className="truncate">{label}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 hidden w-64 rounded-md border border-slate-900/10 bg-slate-950 p-3 text-left text-xs font-normal leading-5 text-white shadow-xl group-hover:block group-focus-within:block"
      >
        {detail}
      </span>
    </span>
  );
}

function ActionWithTooltip({
  tooltip,
  children,
}: {
  tooltip: string;
  children: ReactNode;
}) {
  return (
    <span
      className="group relative inline-flex"
      tabIndex={0}
      title={tooltip}
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-72 -translate-x-1/2 rounded-md border border-slate-900/10 bg-slate-950 p-3 text-left text-xs font-normal leading-5 text-white shadow-xl group-hover:block group-focus:block group-focus-within:block"
      >
        {tooltip}
      </span>
    </span>
  );
}

function describePlayEffect(effect: PlayEffect): string {
  if (effect.label) {
    return effect.label;
  }

  if (effect.type === "draw-deck") {
    return `抽 ${effect.count} 张`;
  }

  return `藏 ${effect.count} 张空地牌`;
}

function describePlayEffectDetail(effect: PlayEffect): string {
  if (effect.type === "draw-deck") {
    return `打出后立即从牌堆摸 ${effect.count} 张牌。若摸到冬季牌，会按冬季终局规则处理。`;
  }

  return `打出后从空地拿 ${effect.count} 张牌放入你的洞穴。洞穴牌会参与带有洞穴计分的效果。`;
}

function describeScoreRule(rule: ScoreRule): string {
  if (rule.label) {
    return rule.label;
  }

  if (rule.type === "per-tree") {
    return rule.species ? `每棵${rule.species} ${rule.points} 分` : `每棵树 ${rule.points} 分`;
  }

  if (rule.type === "per-tag") {
    return `每个${rule.tag} ${rule.points} 分`;
  }

  if (rule.type === "per-pair") {
    return `每对${rule.tag} ${rule.points} 分`;
  }

  if (rule.type === "per-side") {
    return `每个树位 ${rule.points} 分`;
  }

  if (rule.type === "per-position") {
    return `${sideLabel(rule.side)} ${rule.points} 分`;
  }

  if (rule.type === "per-cave") {
    return `每张洞穴牌 ${rule.points} 分`;
  }

  return `每种树 ${rule.points} 分`;
}

function describeScoreRuleDetail(rule: ScoreRule): string {
  if (rule.type === "per-tree") {
    return rule.species
      ? `结算时，你森林中每有 1 棵${rule.species}，这张牌获得 ${rule.points} 分。`
      : `结算时，你森林中每有 1 棵树，这张牌获得 ${rule.points} 分。`;
  }

  if (rule.type === "per-tag") {
    return `结算时，你森林中每有 1 个带有「${rule.tag}」标签的可见住民，这张牌获得 ${rule.points} 分。`;
  }

  if (rule.type === "per-pair") {
    return `结算时，你森林中每凑齐 2 个带有「${rule.tag}」标签的可见住民，这张牌获得 ${rule.points} 分。`;
  }

  if (rule.type === "per-side") {
    return `结算时，这棵树上每有 1 个已占用方向，这张牌获得 ${rule.points} 分。`;
  }

  if (rule.type === "per-position") {
    return `结算时，如果这张牌放在树的${sideLabel(rule.side)}，这张牌获得 ${rule.points} 分。`;
  }

  if (rule.type === "per-cave") {
    return `结算时，你洞穴中每有 1 张牌，这张牌获得 ${rule.points} 分。`;
  }

  return `结算时，你森林中每有 1 种不同树种，这张牌获得 ${rule.points} 分。`;
}

function ScorePanel({
  game,
  score,
  compact = false,
}: {
  game: GameState;
  score: ReturnType<typeof scoreGame>[number];
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-950">{game.players[score.player].name}</h3>
        <span className="text-lg font-semibold text-emerald-800">{score.total}</span>
      </div>
      {!compact ? (
        <ol className="mt-3 max-h-40 space-y-1 overflow-auto text-xs text-slate-600">
          {score.lines.map((line, index) => (
            <li key={`${line.source}-${index}`} className="flex justify-between gap-3">
              <span>{line.source}</span>
              <span>{line.points}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function SeatButton({
  seat,
  connection,
  onClaim,
}: {
  seat: PlayerId;
  connection: ConnectionState;
  onClaim: () => void;
}) {
  const mine = connection.viewerSeat === seat;

  return (
    <button
      type="button"
      className={[
        "rounded-md border px-3 py-1 text-sm font-semibold transition",
        mine
          ? "border-emerald-700 bg-emerald-50 text-emerald-900"
          : "border-slate-300 bg-white text-slate-700 hover:border-emerald-700",
      ].join(" ")}
      onClick={onClaim}
    >
      {seatLabel(seat)}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-900/10 bg-white/80 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-slate-900/10 bg-white/75 px-3 py-1 text-sm">
      {label}
    </span>
  );
}

function ZoneEmpty({ label }: { label: string }) {
  return (
    <div className="col-span-full flex min-h-28 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm font-medium text-slate-500">
      {label}
    </div>
  );
}

function seatLabel(seat: ViewerSeat): string {
  if (seat === 0) {
    return "玩家一";
  }

  if (seat === 1) {
    return "玩家二";
  }

  return "旁观";
}

function connectionStatusLabel(status: ConnectionState["status"]) {
  if (status === "connected") {
    return "已连接";
  }

  if (status === "connecting") {
    return "连接中";
  }

  return "离线";
}

function getClientToken(): string {
  const saved = window.localStorage.getItem(TOKEN_KEY);

  if (saved) {
    return saved;
  }

  const token =
    typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(TOKEN_KEY, token);
  return token;
}

function getWebSocketUrl(port: string): string {
  if (!isPrivateRoomHost(window.location.hostname)) {
    return PUBLIC_ROOM_WS_URL;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const normalizedPort = port.trim() || DEFAULT_ROOM_PORT;
  return `${protocol}//${window.location.hostname}:${normalizedPort}/ws`;
}

function getRoomConnectionError(port: string): string {
  if (!isPrivateRoomHost(window.location.hostname)) {
    return "无法连接线上房间服务，请稍后重试。";
  }

  return `无法连接房间服务，请确认 pnpm forest:server 已在 ${port} 端口运行。`;
}

function isPrivateRoomHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function updateRoomUrl(roomId: string, seat: ViewerSeat) {
  const params = new URLSearchParams(window.location.search);
  params.set("room", roomId);

  if (seat === 0 || seat === 1) {
    params.set("seat", String(seat));
  } else {
    params.delete("seat");
  }

  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
}
