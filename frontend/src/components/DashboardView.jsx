import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import authService from '../services/auth';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  PiggyBank,
  PlusCircle,
  ReceiptText,
  Filter,
  Search,
  LogOut,
  Bell,
  PieChart,
  Calendar,
  X,
  CreditCard,
  Tag,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function DashboardView() {
  const { user, logout } = useAuth();

  // Estado del listado de transacciones
  const [transactions, setTransactions] = useState([]);
  const [filterType, setFilterType] = useState('all'); // all | expense | income
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Formulario para nueva transacción
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('Comida');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Cargar transacciones desde transactions-service
  useEffect(() => {
    async function loadTransactions() {
      const token = authService.getToken();
      if (!token || token.startsWith('demo-session-token')) return;
      try {
        const res = await fetch('/api/transactions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.transactions) {
            setTransactions(
              data.transactions.map((t) => ({
                id: t.id,
                concept: t.category.charAt(0).toUpperCase() + t.category.slice(1),
                amount: t.amount,
                type: 'expense',
                category: t.category.charAt(0).toUpperCase() + t.category.slice(1),
                date: t.date,
              }))
            );
          }
        }
      } catch (err) {
        console.error('Error al obtener transacciones:', err);
      }
    }
    loadTransactions();
  }, [user]);

  // Cálculos rápidos de balance
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const currentBalance = totalIncome - totalExpense;

  const filteredTransactions = transactions.filter((t) => {
    const matchesType = filterType === 'all' || t.type === filterType;
    const matchesSearch =
      (t.concept || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!amount) return;

    const parsedAmount = parseFloat(amount);
    const txCategory = category.trim() || 'Comida';
    const txConcept = concept.trim() || txCategory;
    const txDate = date || new Date().toISOString().split('T')[0];

    const token = authService.getToken();
    if (token && !token.startsWith('demo-session-token')) {
      try {
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount: parsedAmount,
            category: txCategory,
            date: txDate,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const created = data.transaction;
          const newTx = {
            id: created.id,
            concept: txConcept,
            amount: created.amount,
            type,
            category: created.category.charAt(0).toUpperCase() + created.category.slice(1),
            date: created.date,
          };
          setTransactions((prev) => [newTx, ...prev]);
          setConcept('');
          setAmount('');
          setIsModalOpen(false);
          return;
        }
      } catch (err) {
        console.error('Error al registrar en transactions-service:', err);
      }
    }

    const newTx = {
      id: `tx-${Date.now()}`,
      concept: txConcept,
      amount: parsedAmount,
      type,
      category: txCategory,
      date: txDate,
    };

    setTransactions((prev) => [newTx, ...prev]);
    // Reset form
    setConcept('');
    setAmount('');
    setIsModalOpen(false);
  };

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    const parts = user.name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return user.name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-xl">
              🪙
            </div>
            <div>
              <span className="font-extrabold text-lg text-white tracking-tight flex items-center gap-1.5">
                Centavo
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Dashboard
                </span>
              </span>
            </div>
          </div>

          {/* Navigation links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-400">
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-emerald-400 font-semibold cursor-default">
              Resumen
            </span>
            <span className="px-3 py-1.5 rounded-lg hover:text-slate-200 transition-colors cursor-pointer">
              Transacciones
            </span>
            <span className="px-3 py-1.5 rounded-lg hover:text-slate-200 transition-colors cursor-pointer">
              Presupuestos
            </span>
            <span className="px-3 py-1.5 rounded-lg hover:text-slate-200 transition-colors cursor-pointer">
              Reportes
            </span>
          </nav>

          {/* Right actions: notifications & user profile */}
          <div className="flex items-center gap-3">
            {/* Notification alert icon */}
            <button
              title="Notificaciones y alertas de sobregasto"
              className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400" />
            </button>

            {/* User profile dropdown / info */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-xs text-white shadow-inner">
                  {getUserInitials()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
                    {user?.name || 'Usuario'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[120px]">
                    {user?.email || 'usuario@centavo.app'}
                  </div>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={logout}
                title="Cerrar Sesión"
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Hola, {user?.name ? user.name.split(' ')[0] : 'Bienvenido'} 👋
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Aquí tienes el resumen financiero y el registro de tus movimientos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all duration-200 transform active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nueva Transacción</span>
            </button>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card: Balance General */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm shadow-sm hover:border-slate-600/60 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Balance General</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              ${currentBalance.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Actualizado al día de hoy</span>
            </div>
          </div>

          {/* Card: Ingresos */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm shadow-sm hover:border-slate-600/60 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Ingresos del Mes</span>
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">
              +${totalIncome.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {transactions.filter((t) => t.type === 'income').length} movimientos registrados
            </div>
          </div>

          {/* Card: Gastos */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm shadow-sm hover:border-slate-600/60 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Gastos Acumulados</span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-rose-400 tracking-tight">
              -${totalExpense.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {transactions.filter((t) => t.type === 'expense').length} movimientos registrados
            </div>
          </div>

          {/* Card: Presupuesto Restante */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm shadow-sm hover:border-slate-600/60 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Presupuesto Mensual</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <PiggyBank className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              $0.00
            </div>
            <div className="mt-2 text-xs text-amber-400/90 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Sin topes configurados</span>
            </div>
          </div>
        </section>

        {/* Transactions Section */}
        <section className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
          {/* Header of Transactions List */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700/60">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-emerald-400" />
                Listado de Transacciones
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Registro y categorización de movimientos financieros de tu cuenta
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Switcher */}
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700/60 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    filterType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('expense')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    filterType === 'expense' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Gastos
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('income')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    filterType === 'income' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ingresos
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar movimiento..."
                  className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* List Content: Listado de transacciones */}
          <div className="pt-6">
            {filteredTransactions.length === 0 ? (
              /* EMPTY STATE: Listado vacío de transacciones */
              <div className="py-16 px-4 text-center flex flex-col items-center justify-center max-w-md mx-auto">
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-3xl bg-slate-800 border border-slate-700/70 flex items-center justify-center text-slate-400 shadow-xl">
                    <ReceiptText className="w-10 h-10 text-emerald-400/80" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xs">
                    🪙
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white mb-2">
                  No hay transacciones registradas aún
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
                  Tu historial financiero está listo para comenzar. Registra tus ingresos o gastos cotidianos para visualizar el balance y monitorear tus presupuestos.
                </p>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 font-semibold text-xs sm:text-sm transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Registrar primera transacción</span>
                </button>
              </div>
            ) : (
              /* Populated list view */
              <div className="divide-y divide-slate-800 overflow-x-auto">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="py-3.5 px-3 flex items-center justify-between hover:bg-slate-800/40 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          tx.type === 'income'
                            ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {tx.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{tx.concept}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                            {tx.category}
                          </span>
                          <span>{tx.date}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-sm font-bold ${
                        tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}$
                      {Number(tx.amount).toLocaleString('es-MX', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modal: Registrar Transacción */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Nueva Transacción</h3>
                <p className="text-xs text-slate-400">Captura un ingreso o gasto a tu cuenta</p>
              </div>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Tipo de Movimiento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      type === 'expense'
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>Gasto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      type === 'income'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Ingreso</span>
                  </button>
                </div>
              </div>

              {/* Concept */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Concepto / Descripción
                </label>
                <input
                  type="text"
                  required
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej. Supermercado, Salario mensual, Transporte..."
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Monto ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Comida">Comida</option>
                  <option value="Alimentación">Alimentación</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Vivienda">Vivienda & Servicios</option>
                  <option value="Entretenimiento">Entretenimiento</option>
                  <option value="Salud">Salud & Bienestar</option>
                  <option value="Sueldo / Nómina">Sueldo / Nómina</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">
                  Fecha
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-semibold shadow-md shadow-emerald-500/20"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
