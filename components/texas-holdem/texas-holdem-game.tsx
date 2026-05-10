"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  applyPlayerAction,
  createNewHoldemGame,
  getLegalActions,
  getPhaseLabel,
  getPotSize,
  startNextHand,
} from "@/lib/texas-holdem/engine";
import { rankLabel, suitSymbol } from "@/lib/texas-holdem/evaluator";
import type {
  RoomGameAction,
  RoomServerMessage,
  ViewerSeat,
} from "@/lib/texas-holdem/room";
import type { Card, PlayerAction, TexasHoldemGameState } from "@/lib/texas-holdem/types";

const PLAYER_NAMES = ["你", "左手位", "对门", "右手位", "短筹码", "深筹码"];
const PLAYER_COUNTS = [2, 3, 4, 5, 6];
const TOKEN_KEY = "texas-holdem-client-token-v1";
const DEFAULT_ROOM_PORT = "8788";

interface ConnectionState {
  status: "offline" | "connecting" | "connected";
  roomId: string;
  viewerSeat: ViewerSeat;
  error: string | null;
}

export function TexasHoldemGame() {
  const socketRef = useRef<WebSocket | null>(null);
  const [playerCount, setPlayerCount] = useState(4);
  const [revealAll, setRevealAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>({
    status: "offline",
    roomId: "",
    viewerSeat: "spectator",
    error: null,
  });
  const [playerName, setPlayerName] = useState("你");
  const [preferredSeat, setPreferredSeat] = useState(0);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [serverPort, setServerPort] = useState(DEFAULT_ROOM_PORT);
  const [pageOrigin, setPageOrigin] = useState("");
  const [game, setGame] = useState<TexasHoldemGameState>(() =>
    createGame(4, "texas-holdem-initial-4"),
  );
  const legal = useMemo(() => getLegalActions(game), [game]);
  const defaultWagerTarget = getDefaultWagerTarget(game, legal);
  const [wagerTarget, setWagerTarget] = useState(defaultWagerTarget);
  const currentPlayer = game.currentPlayer === null ? null : game.players[game.currentPlayer];
  const isConnected = connection.status === "connected";
  const isConnecting = connection.status === "connecting";
  const canUseActions =
    !isConnected ||
    (typeof connection.viewerSeat === "number" && connection.viewerSeat === game.currentPlayer);
  const showWagerControl = canUseActions && (legal.canBet || legal.canRaise);
  const inviteUrl =
    pageOrigin && connection.roomId
      ? `${pageOrigin}/texas-holdem/?room=${connection.roomId}`
      : "";
  const clampedWagerTarget = clamp(
    wagerTarget || defaultWagerTarget,
    defaultWagerTarget,
    Math.max(defaultWagerTarget, legal.maxRaiseTo),
  );

  useEffect(() => {
    setPageOrigin(window.location.origin);

    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("room");
    const seat = params.get("seat");

    if (roomId) {
      setRoomIdInput(roomId.toUpperCase());
    }

    if (seat) {
      const seatNumber = Number(seat);
      if (Number.isInteger(seatNumber) && seatNumber >= 0 && seatNumber <= 5) {
        setPreferredSeat(seatNumber);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      socketRef.current?.close();
    };
  }, []);

  useEffect(() => {
    setWagerTarget(defaultWagerTarget);
  }, [
    defaultWagerTarget,
    game.currentPlayer,
    game.phase,
    game.highestBet,
    legal.maxRaiseTo,
  ]);

  function resetTable(nextPlayerCount = playerCount) {
    setMessage(null);
    setRevealAll(false);
    setPlayerCount(nextPlayerCount);
    setPreferredSeat((current) => Math.min(current, nextPlayerCount - 1));

    if (isConnected) {
      sendAction({ type: "new-game", playerCount: nextPlayerCount });
      return;
    }

    setGame(createGame(nextPlayerCount, `texas-holdem-${Date.now()}-${nextPlayerCount}`));
  }

  function act(type: "fold" | "check" | "call") {
    const action: PlayerAction = { type };

    try {
      setMessage(null);
      sendPlayerAction(action);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "动作无效。");
    }
  }

  function wager(amount: number) {
    try {
      setMessage(null);
      sendPlayerAction({
        type: game.highestBet === 0 ? "bet" : "raise",
        amount,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "下注无效。");
    }
  }

  function nextHand() {
    setMessage(null);

    if (isConnected) {
      sendAction(
        game.phase === "game-over"
          ? { type: "new-game", playerCount }
          : { type: "next-hand" },
      );
      return;
    }

    setGame((current) =>
      current.phase === "game-over"
        ? createGame(playerCount, `texas-holdem-${Date.now()}-${playerCount}`)
        : startNextHand(current),
    );
  }

  function sendPlayerAction(action: PlayerAction) {
    if (game.currentPlayer === null) {
      return;
    }

    if (isConnected) {
      sendAction({ type: "player-action", playerId: game.currentPlayer, action });
      return;
    }

    setGame((current) => applyPlayerAction(current, action));
  }

  async function connectToRoom(mode: "create" | "join") {
    const token = getClientToken();
    const roomId = roomIdInput.trim().toUpperCase();
    const normalizedPort = serverPort.trim() || DEFAULT_ROOM_PORT;

    if (mode === "join" && !roomId) {
      setConnection((current) => ({
        ...current,
        error: "请输入房间号。",
      }));
      return;
    }

    socketRef.current?.close();
    setConnection({
      status: "connecting",
      roomId: mode === "join" ? roomId : "",
      viewerSeat: "spectator",
      error: null,
    });

    try {
      await ensureRoomServer(normalizedPort);
    } catch (error) {
      setConnection((current) => ({
        ...current,
        status: "offline",
        error:
          error instanceof Error
            ? error.message
            : "房间服务自动启动失败，请手动执行 pnpm run holdem:server。",
      }));
      return;
    }

    const socket = new WebSocket(getWebSocketUrl(normalizedPort));
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify(
          mode === "create"
            ? {
                type: "create-room",
                token,
                name: playerName,
                seat: preferredSeat,
                playerCount,
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
      const roomMessage = JSON.parse(String(event.data)) as RoomServerMessage;

      if (roomMessage.type === "snapshot") {
        const nextPlayerCount = roomMessage.snapshot.game.players.length;
        setGame(roomMessage.snapshot.game);
        setPlayerCount(nextPlayerCount);
        setRoomIdInput(roomMessage.snapshot.roomId);
        if (typeof roomMessage.snapshot.viewerSeat === "number") {
          setPreferredSeat(roomMessage.snapshot.viewerSeat);
        }
        setConnection({
          status: "connected",
          roomId: roomMessage.snapshot.roomId,
          viewerSeat: roomMessage.snapshot.viewerSeat,
          error: null,
        });
        updateRoomUrl(roomMessage.snapshot.roomId, roomMessage.snapshot.viewerSeat);
        return;
      }

      if (roomMessage.type === "notice") {
        setMessage(roomMessage.message);
        return;
      }

      if (roomMessage.type === "error") {
        setConnection((current) => ({
          ...current,
          status: current.status === "connecting" ? "offline" : current.status,
          error: roomMessage.message,
        }));
      }
    };

    socket.onerror = () => {
      setConnection((current) => ({
        ...current,
        status: "offline",
        error: `无法连接德州房间服务。页面已尝试自动启动，请确认 pnpm run holdem:server 已在 ${normalizedPort} 端口运行。`,
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

  function claimSeat(seat: number) {
    sendRoomMessage({
      type: "claim-seat",
      token: getClientToken(),
      roomId: connection.roomId,
      name: playerName,
      seat,
    });
  }

  function sendAction(action: RoomGameAction) {
    sendRoomMessage({
      type: "action",
      token: getClientToken(),
      roomId: connection.roomId,
      action,
    });
  }

  function sendRoomMessage(roomMessage: object) {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setConnection((current) => ({
        ...current,
        error: "房间连接已断开。",
      }));
      return;
    }

    socket.send(JSON.stringify(roomMessage));
  }

  return (
    <main className="space-y-5 text-slate-100">
      <section className="overflow-hidden rounded-3xl border border-emerald-950/20 bg-slate-950 shadow-[0_34px_120px_-72px_rgba(2,6,23,0.95)]">
        <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(20,184,166,0.22),rgba(244,114,182,0.14),rgba(250,204,21,0.12))] px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-200">
                Texas Hold'em
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                德州扑克桌游
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/games"
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-300 hover:text-amber-100"
              >
                游戏入口
              </Link>
              <button
                type="button"
                onClick={() => setRevealAll((current) => !current)}
                disabled={isConnected}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isConnected ? "联网保护手牌" : revealAll ? "隐藏手牌" : "亮出手牌"}
              </button>
              <button
                type="button"
                onClick={() => resetTable()}
                className="rounded-full bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
              >
                重开牌桌
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_20rem] lg:p-6">
          <div className="rounded-[2rem] border border-emerald-200/10 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.44),rgba(5,46,22,0.98)_62%,rgba(2,6,23,0.96)_100%)] p-4 shadow-inner shadow-emerald-950/70 sm:p-6">
            <div className="grid gap-4 xl:grid-cols-[16rem_1fr_16rem] xl:items-center">
              <SeatColumn
                players={game.players.slice(0, Math.ceil(game.players.length / 2))}
                game={game}
                revealAll={revealAll}
                isConnected={isConnected}
                viewerSeat={connection.viewerSeat}
              />

              <section className="min-h-[26rem] rounded-[2rem] border border-emerald-100/18 bg-emerald-950/46 p-4 shadow-[inset_0_0_56px_rgba(4,120,87,0.52)]">
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard label="阶段" value={getPhaseLabel(game.phase)} />
                  <StatCard label="底池" value={String(getPotSize(game))} />
                  <StatCard label="第几手" value={`#${game.handNumber}`} />
                </div>

                <div className="mt-8 flex flex-col items-center gap-4">
                  <div className="flex min-h-28 flex-wrap items-center justify-center gap-3">
                    {game.communityCards.length > 0 ? (
                      game.communityCards.map((card) => (
                        <PlayingCard key={card.id} card={card} />
                      ))
                    ) : (
                      <div className="grid h-24 w-full max-w-md place-items-center rounded-2xl border border-dashed border-emerald-100/25 bg-emerald-900/32 text-sm font-semibold text-emerald-50/70">
                        公共牌
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <ChipStack tone="rose" label={`小盲 ${game.smallBlind}`} />
                    <ChipStack tone="amber" label={`大盲 ${game.bigBlind}`} />
                    <ChipStack tone="cyan" label={`桌面注额 ${game.highestBet}`} />
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/48 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-100/75">行动位</p>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        {currentPlayer ? currentPlayer.name : "等待下一手"}
                      </p>
                    </div>
                    {message ? (
                      <p className="rounded-full bg-rose-400/18 px-3 py-1 text-sm font-semibold text-rose-100">
                        {message}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={!canUseActions || !legal.canFold}
                      onClick={() => act("fold")}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-rose-300 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      弃牌
                    </button>
                    <button
                      type="button"
                      disabled={!canUseActions || (!legal.canCheck && !legal.canCall)}
                      onClick={() => act(legal.canCheck ? "check" : "call")}
                      className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-emerald-300 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {legal.canCheck ? "过牌" : `跟注 ${legal.callAmount}`}
                    </button>
                    <button
                      type="button"
                      disabled={!showWagerControl}
                      onClick={() => wager(clampedWagerTarget)}
                      className="rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {game.highestBet === 0 ? `下注 ${clampedWagerTarget}` : `加注到 ${clampedWagerTarget}`}
                    </button>
                  </div>

                  {showWagerControl ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 p-4">
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-200">
                        <span>{game.highestBet === 0 ? "下注额" : "加注目标"}</span>
                        <span>{clampedWagerTarget}</span>
                      </div>
                      <input
                        type="range"
                        min={defaultWagerTarget}
                        max={legal.maxRaiseTo}
                        step={game.bigBlind}
                        value={clampedWagerTarget}
                        onChange={(event) => setWagerTarget(Number(event.target.value))}
                        className="mt-3 w-full accent-amber-300"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => wager(defaultWagerTarget)}
                          className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-amber-300"
                        >
                          最小
                        </button>
                        <button
                          type="button"
                          onClick={() => wager(legal.maxRaiseTo)}
                          className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-amber-300"
                        >
                          全下
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {game.phase === "hand-complete" || game.phase === "game-over" ? (
                    <button
                      type="button"
                      onClick={nextHand}
                      className="mt-4 w-full rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200"
                    >
                      {game.phase === "game-over" ? "新开牌局" : "下一手"}
                    </button>
                  ) : null}
                </div>
              </section>

              <SeatColumn
                players={game.players.slice(Math.ceil(game.players.length / 2))}
                game={game}
                revealAll={revealAll}
                isConnected={isConnected}
                viewerSeat={connection.viewerSeat}
              />
            </div>
          </div>

          <aside className="space-y-4 rounded-[2rem] border border-white/10 bg-slate-900 p-4">
            <section className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/65">
                    LAN Room
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">朋友同桌</h2>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                  {connectionStatusLabel(connection.status)}
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold text-slate-200">
                  名字
                  <input
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    className="min-h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-200">
                  服务端口
                  <input
                    value={serverPort}
                    onChange={(event) => setServerPort(event.target.value)}
                    className="min-h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-slate-200">
                  房间号
                  <input
                    value={roomIdInput}
                    onChange={(event) => setRoomIdInput(event.target.value.toUpperCase())}
                    className="min-h-10 rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm uppercase text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-200"
                  />
                </label>
                <div>
                  <p className="text-sm font-semibold text-slate-200">座位</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from({ length: playerCount }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setPreferredSeat(index)}
                        className={`h-9 w-9 rounded-full text-xs font-black transition ${
                          preferredSeat === index
                            ? "bg-cyan-200 text-slate-950"
                            : "border border-white/15 text-slate-200 hover:border-cyan-200"
                        }`}
                      >
                        P{index + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => connectToRoom("create")}
                  disabled={isConnecting}
                  className="rounded-xl bg-cyan-200 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  创建房间
                </button>
                <button
                  type="button"
                  onClick={() => connectToRoom("join")}
                  disabled={isConnecting || isConnected}
                  className="rounded-xl bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isConnected ? "已加入" : isConnecting ? "加入中" : "加入房间"}
                </button>
              </div>

              {connection.roomId ? (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {game.players.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => claimSeat(player.id)}
                        disabled={!isConnected}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                          connection.viewerSeat === player.id
                            ? "border-cyan-200 bg-cyan-200 text-slate-950"
                            : "border-white/15 text-slate-200 hover:border-cyan-200"
                        }`}
                      >
                        {player.name}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={disconnectRoom}
                    className="w-full rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-200 hover:text-rose-100"
                  >
                    断开房间
                  </button>
                </div>
              ) : null}

              {inviteUrl ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 p-3 font-mono text-xs leading-5 text-cyan-100">
                  {inviteUrl}
                </div>
              ) : null}
              {connection.error ? (
                <p className="mt-3 rounded-xl bg-rose-400/14 px-3 py-2 text-sm font-semibold text-rose-100">
                  {connection.error}
                </p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <h2 className="text-lg font-semibold text-white">牌桌</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {PLAYER_COUNTS.map((count) => (
                  <button
                    type="button"
                    key={count}
                    onClick={() => resetTable(count)}
                    className={`h-10 w-10 rounded-full text-sm font-semibold transition ${
                      playerCount === count
                        ? "bg-amber-300 text-slate-950"
                        : "border border-white/15 text-slate-200 hover:border-amber-300"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <h2 className="text-lg font-semibold text-white">结算</h2>
              <div className="mt-3 space-y-3">
                {game.winners.length > 0 ? (
                  game.winners.map((winner) => (
                    <div
                      key={winner.playerId}
                      className="rounded-2xl border border-amber-200/20 bg-amber-300/12 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-amber-100">{winner.name}</span>
                        <span className="font-semibold text-amber-200">+{winner.amount}</span>
                      </div>
                      <p className="mt-1 text-sm text-amber-50/76">{winner.handLabel}</p>
                      {winner.cards.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {winner.cards.map((card) => (
                            <MiniCard key={card.id} card={card} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate-300">等待摊牌。</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/6 p-4">
              <h2 className="text-lg font-semibold text-white">牌局记录</h2>
              <div className="mt-3 space-y-2">
                {game.actionLog.map((entry, index) => (
                  <p
                    key={`${entry}-${index}`}
                    className="rounded-xl bg-slate-950/44 px-3 py-2 text-sm leading-6 text-slate-200"
                  >
                    {entry}
                  </p>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function SeatColumn({
  players,
  game,
  revealAll,
  isConnected,
  viewerSeat,
}: {
  players: TexasHoldemGameState["players"];
  game: TexasHoldemGameState;
  revealAll: boolean;
  isConnected: boolean;
  viewerSeat: ViewerSeat;
}) {
  return (
    <div className="grid gap-3">
      {players.map((player) => {
        const isCurrent = game.currentPlayer === player.id;
        const revealCards =
          (!isConnected && (revealAll || isCurrent)) ||
          viewerSeat === player.id ||
          game.phase === "hand-complete" ||
          game.phase === "game-over";

        return (
          <article
            key={player.id}
            className={`rounded-3xl border p-3 transition ${
              isCurrent
                ? "border-amber-200 bg-amber-200/14 shadow-[0_0_32px_rgba(251,191,36,0.2)]"
                : "border-white/10 bg-slate-950/46"
            } ${player.folded ? "opacity-55" : ""}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white">{player.name}</h3>
                  {game.dealerIndex === player.id ? (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-black text-slate-950">
                      D
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-300">筹码 {player.chips}</p>
              </div>
              <div className="text-right text-sm font-semibold text-slate-300">
                {player.folded ? "已弃牌" : player.allIn ? "All-in" : `下注 ${player.currentBet}`}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {player.holeCards.map((card) => (
                <PlayingCard key={card.id} card={card} hidden={!revealCards} compact />
              ))}
            </div>
            {player.lastHand ? (
              <p className="mt-2 text-sm font-semibold text-emerald-100">
                {player.lastHand.label}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function PlayingCard({
  card,
  hidden = false,
  compact = false,
}: {
  card: Card;
  hidden?: boolean;
  compact?: boolean;
}) {
  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  if (hidden) {
    return (
      <div
        className={`grid shrink-0 place-items-center rounded-xl border border-cyan-100/30 bg-[linear-gradient(135deg,#0f766e,#1d4ed8_52%,#7c3aed)] shadow-lg shadow-slate-950/35 ${
          compact ? "h-16 w-11" : "h-24 w-16 sm:h-28 sm:w-20"
        }`}
      >
        <div className="h-2/3 w-2/3 rounded-lg border border-white/30 bg-white/10" />
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 rounded-xl border border-slate-900/10 bg-stone-50 text-slate-950 shadow-lg shadow-slate-950/30 ${
        compact ? "h-16 w-11 p-1.5" : "h-24 w-16 p-2 sm:h-28 sm:w-20 sm:p-2.5"
      } ${isRed ? "text-rose-600" : "text-slate-950"}`}
    >
      <div className="text-sm font-black leading-none sm:text-base">{rankLabel(card.rank)}</div>
      <div className="text-base leading-none sm:text-lg">{suitSymbol(card.suit)}</div>
      <div className="absolute inset-x-0 bottom-2 text-center text-2xl leading-none sm:text-3xl">
        {suitSymbol(card.suit)}
      </div>
    </div>
  );
}

function MiniCard({ card }: { card: Card }) {
  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  return (
    <span
      className={`rounded-md bg-stone-50 px-2 py-1 text-xs font-black ${
        isRed ? "text-rose-600" : "text-slate-950"
      }`}
    >
      {rankLabel(card.rank)}
      {suitSymbol(card.suit)}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/42 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/60">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ChipStack({ tone, label }: { tone: "rose" | "amber" | "cyan"; label: string }) {
  const toneClass = {
    rose: "border-rose-200/35 bg-rose-300/18 text-rose-50",
    amber: "border-amber-200/40 bg-amber-300/18 text-amber-50",
    cyan: "border-cyan-200/40 bg-cyan-300/16 text-cyan-50",
  }[tone];

  return (
    <span
      className={`rounded-full border px-3 py-1 text-sm font-semibold shadow-sm ${toneClass}`}
    >
      {label}
    </span>
  );
}

function createGame(playerCount: number, seed: string) {
  return createNewHoldemGame({
    playerNames: PLAYER_NAMES.slice(0, playerCount),
    seed,
  });
}

function getDefaultWagerTarget(
  game: TexasHoldemGameState,
  legal: ReturnType<typeof getLegalActions>,
) {
  if (legal.canBet) {
    return legal.minBet;
  }

  if (legal.canRaise) {
    return legal.minRaiseTo;
  }

  return game.highestBet;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getClientToken() {
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

async function ensureRoomServer(port: string) {
  const bootstrapUrl = getRoomServerBootstrapUrl();

  if (!bootstrapUrl) {
    return;
  }

  let response: Response;

  try {
    response = await fetch(bootstrapUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ port: Number(port) }),
      cache: "no-store",
    });
  } catch {
    return;
  }

  if (response.status === 404) {
    return;
  }

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
  } | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error ?? "房间服务自动启动失败，请手动执行 pnpm run holdem:server。");
  }
}

function getRoomServerBootstrapUrl() {
  const hostname = window.location.hostname;

  if (hostname.endsWith("github.io")) {
    return "";
  }

  if (isPrivateRoomHost(hostname)) {
    return `${window.location.protocol}//${hostname}:8789/api/texas-holdem/ensure-room-server`;
  }

  return "/api/texas-holdem/ensure-room-server";
}

function getWebSocketUrl(port: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const normalizedPort = port.trim() || DEFAULT_ROOM_PORT;
  const hostname = window.location.hostname;

  if (!isPrivateRoomHost(hostname) && window.location.protocol === "https:") {
    return `${protocol}//${window.location.host}/ws`;
  }

  return `${protocol}//${hostname}:${normalizedPort}/ws`;
}

function isPrivateRoomHost(hostname: string) {
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

  if (typeof seat === "number") {
    params.set("seat", String(seat));
  } else {
    params.delete("seat");
  }

  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
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
