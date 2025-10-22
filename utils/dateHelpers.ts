// Converte Date para string YYYY-MM-DD ou retorna string se já for YYYY-MM-DD
export function formatDateToYYYYMMDD(date: Date | string): string {
  if (typeof date === "string") {
    // Already in YYYY-MM-DD format
    return date;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Parse YYYY-MM-DD para Date (meia-noite local)
export function parseYYYYMMDD(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Converte Date para string YYYY-MM-DD em UTC
export function formatDateToYYYYMMDDUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Checa se data é no passado (compara apenas dia)
export function isDateInPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  return targetDate < today;
}

// Retorna número de dias no mês
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// Gera grid 6x7 de datas para o calendário mensal
// Inclui dias do mês anterior/seguinte para preencher grid
export function getMonthCalendarGrid(year: number, month: number): Date[][] {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Dia da semana do primeiro dia (0 = domingo, 6 = sábado)
  const firstDayWeekday = firstDayOfMonth.getDay();

  // Número de dias no mês
  const daysInMonth = lastDayOfMonth.getDate();

  // Número de dias do mês anterior a mostrar
  const daysFromPrevMonth = firstDayWeekday;

  // Calcular primeiro dia a mostrar (pode ser do mês anterior)
  const firstDayToShow = new Date(firstDayOfMonth);
  firstDayToShow.setDate(firstDayToShow.getDate() - daysFromPrevMonth);

  const grid: Date[][] = [];
  let currentDate = new Date(firstDayToShow);

  // Gerar 6 semanas (42 dias)
  for (let week = 0; week < 6; week++) {
    const weekDays: Date[] = [];

    for (let day = 0; day < 7; day++) {
      weekDays.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    grid.push(weekDays);
  }

  return grid;
}

// Compara se duas datas são do mesmo dia (ignora hora)
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// Formata range de horas: "08:00 - 17:00"
export function formatTimeRange(startTime: Date, endTime: Date): string {
  const start = formatTimeOnly(startTime);
  const end = formatTimeOnly(endTime);
  return `${start} - ${end}`;
}

// Extrai HH:mm de Date
export function formatTimeOnly(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Cria Date com hora específica (para usar em forms)
export function setTimeOnDate(date: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
}

// Trunca Date para meia-noite UTC (para salvar no banco)
export function truncateToDateUTC(date: Date): Date {
  const utcDate = new Date(date);
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate;
}

// Converte Date para string HH:mm (formato para inputs time)
export function formatTimeForInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Converte string HH:mm para Date (assumindo data atual)
export function parseTimeString(timeStr: string, baseDate?: Date): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Verifica se um horário está dentro de outro range
export function isTimeInRange(
  time: Date,
  startTime: Date,
  endTime: Date
): boolean {
  const timeMinutes = time.getHours() * 60 + time.getMinutes();
  const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
  const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();

  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

// Adiciona minutos a um horário
export function addMinutesToTime(time: Date, minutes: number): Date {
  const newTime = new Date(time);
  newTime.setMinutes(newTime.getMinutes() + minutes);
  return newTime;
}

// Retorna o nome do mês em português
export function getMonthName(month: number): string {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return months[month];
}

// Retorna o nome abreviado do mês em português
export function getMonthNameShort(month: number): string {
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return months[month];
}

// Retorna o nome do dia da semana em português
export function getWeekdayName(weekday: number): string {
  const weekdays = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];
  return weekdays[weekday];
}

// Retorna o nome abreviado do dia da semana em português
export function getWeekdayNameShort(weekday: number): string {
  const weekdays = ["D", "S", "T", "Q", "Q", "S", "S"];
  return weekdays[weekday];
}

// Extrai mês de string YYYY-MM-DD
export function extractMonthFromDateString(dateStr: string): number {
  return parseInt(dateStr.split("-")[1]);
}

// Extrai ano de string YYYY-MM-DD
export function extractYearFromDateString(dateStr: string): number {
  return parseInt(dateStr.split("-")[0]);
}
