export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">배고파</h1>
        <p className="mt-3 text-xl text-zinc-500 dark:text-zinc-400">
          뭐 먹지? 게임으로 골라줄게!
        </p>
      </div>

      <button className="rounded-full bg-orange-500 px-8 py-4 text-lg font-semibold text-white transition-transform hover:scale-105 hover:bg-orange-600 active:scale-95">
        내 주변 음식점 찾기
      </button>

      <p className="text-sm text-zinc-400">
        위치 정보를 공유하면 주변 맛집을 핀볼로 골라드려요
      </p>
    </div>
  );
}
