import React, { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, ArrowLeft, Sun, Moon } from "lucide-react";
import { ColleagueApi } from "../../lib/apiClient";
import { useTheme } from "next-themes";

const quotes = [
  { text: "Торт — это ложь.", source: "Portal 2, GLaDOS" },
  { text: "Вы бы не могли подписать мою петицию?", source: "Postal 2, Dude" },
  { text: "Жить или не жить?", source: "Шекспир, «Гамлет»" },
  { text: "Я не в настроении умирать сегодня.", source: "Властелин колец, Арагорн" },
  { text: "Война не меняется.", source: "Fallout, рассказчик" },
  { text: "Время приключений!", source: "Adventure Time, Джейк" },
  { text: "С нами Бог.", source: "Call of Duty, капитан Прайс" },
  { text: "Одни лишь ветры и дожди...", source: "Dark Souls, предмет «Человечность»" },
  { text: "Какой день! Никогда не забуду этот день, когда я встретил вас.", source: "Ведьмак 3, Геральт" },
  { text: "Тише едешь — дальше будешь.", source: "Народная мудрость" },
  { text: "Свобода — это право выбирать.", source: "Half-Life 2, G-Man" },
  { text: "Мы здесь, чтобы помочь.", source: "Portal, Турель" },
  { text: "Правда освобождает.", source: "Assassin's Creed, девиз ассасинов" },
  { text: "Всё, что нас не убивает, делает нас сильнее.", source: "Фридрих Ницше" },
  { text: "Не беги за прошлым — оно тебя не догонит.", source: "Red Hot Chili Peppers, «Californication»" },
  { text: "Это жизнь, и она прекрасна.", source: "The Last of Us, Джоэл" },
  { text: "Бойтесь тишины, ибо в ней скрывается опасность.", source: "S.T.A.L.K.E.R., сталкер" },
];

export function Auth({ onLogin, onBack }: { onLogin: (token: string, username: string) => void; onBack: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState(quotes[0]);
  const { theme, setTheme } = useTheme();

  const randomQuote = () => {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    setQuote(quotes[randomIndex]);
  };

  useEffect(() => {
    randomQuote();
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Заполните все поля");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isLogin) {
        const userAgent = navigator.userAgent;
        const platformInfo = navigator.platform || "Unknown";
        const screenRes = `${window.screen.width}x${window.screen.height}`;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const rawHwid = `${userAgent}-${platformInfo}-${screenRes}-${timezone}`;
        const hwidBuffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawHwid));
        const hwidHash = Array.from(new Uint8Array(hwidBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        const isMobile = /Mobi|Android/i.test(userAgent);
        let deviceModel = "Unknown Device";
        if (/iPhone/i.test(userAgent)) deviceModel = "iPhone";
        else if (/iPad/i.test(userAgent)) deviceModel = "iPad";
        else if (/Android/i.test(userAgent)) deviceModel = "Android Device";
        else if (/Windows/i.test(userAgent)) deviceModel = "Windows PC";
        else if (/Mac/i.test(userAgent)) deviceModel = "Mac";
        else if (/Linux/i.test(userAgent)) deviceModel = "Linux PC";
        const deviceName = isMobile ? `Mobile Browser (${deviceModel})` : `Web Browser (${deviceModel})`;

        const data = await ColleagueApi.login(username, password, {
          device_name: deviceName,
          device_model: deviceModel,
          platform: platformInfo,
          hwid: hwidHash
        });
        onLogin(data.token, username);
      } else {
        await ColleagueApi.register(username, password);
        alert("Регистрация успешна! Теперь войдите.");
        setIsLogin(true);
        setPassword("");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .animated-bg {
          background: linear-gradient(135deg, #667eea, #764ba2, #f093fb, #4facfe);
          background-size: 400% 400%;
          animation: gradientShift 25s ease infinite;
        }
        .dark .animated-bg {
          background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460, #533483, #2b2b4f);
          background-size: 400% 400%;
          animation: gradientShift 25s ease infinite;
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      <div className="animated-bg min-h-screen flex flex-col items-center justify-center p-4 relative">
        {/* Кнопка переключения темы */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="fixed top-4 right-4 p-2 rounded-full bg-white/80 dark:bg-gray-800 shadow-md z-10 transition-all"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={20} className="text-yellow-500" /> : <Moon size={20} className="text-gray-700" />}
        </button>

        <div className="w-full max-w-md rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-2xl shadow-blue-500/10 dark:shadow-indigo-500/20 transition-all duration-300 hover:shadow-blue-500/20 dark:hover:shadow-indigo-500/30">
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {isLogin ? "Добро пожаловать" : "Создать аккаунт"}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                {isLogin ? "Войдите в свой аккаунт" : "Зарегистрируйтесь, чтобы начать общение"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Имя пользователя"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="Пароль"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && <div className="text-destructive text-sm text-center">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  "Загрузка..."
                ) : isLogin ? (
                  <>
                    <LogIn size={18} /> Войти
                  </>
                ) : (
                  <>
                    <UserPlus size={18} /> Зарегистрироваться
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsLogin(!isLogin); setError(""); setPassword(""); }}
                className="text-sm text-primary hover:underline"
              >
                {isLogin ? "Нет аккаунта? Зарегистрируйтесь" : "Уже есть аккаунт? Войдите"}
              </button>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={onBack}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center justify-center gap-1 w-full"
              >
                <ArrowLeft size={16} /> Назад к выбору способа входа
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center max-w-md animate-fadeIn">
          <div className="inline-block bg-muted/50 rounded-xl px-5 py-3 shadow-sm transition-all">
            <p className="text-foreground text-base italic font-medium">
              «{quote.text}»
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              — {quote.source}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}