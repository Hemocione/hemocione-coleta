const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN = 56;
const FONT_SIZE = 12;
const LINE_HEIGHT = 16;
const MAX_LINE_LENGTH = 92;
const LINES_PER_PAGE = 45;

const WIN_ANSI_REPLACEMENTS: Record<string, string> = {
  "\u00a0": " ",
  "\u2013": "-",
  "\u2014": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u2022": "*",
};

function toWinAnsi(value: string): string {
  return Array.from(value, (character) => {
    const replacement = WIN_ANSI_REPLACEMENTS[character] ?? character;
    return replacement.charCodeAt(0) <= 255 ? replacement : "?";
  }).join("");
}

function escapePdfString(value: string): string {
  const bytes = Buffer.from(toWinAnsi(value), "latin1");
  let escaped = "";

  for (const byte of bytes) {
    if (byte === 40 || byte === 41 || byte === 92) {
      escaped += `\\${String.fromCharCode(byte)}`;
    } else if (byte < 32 || byte > 126) {
      escaped += `\\${byte.toString(8).padStart(3, "0")}`;
    } else {
      escaped += String.fromCharCode(byte);
    }
  }

  return `(${escaped})`;
}

function wrapLine(line: string): string[] {
  if (!line) return [""];

  const words = line.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= MAX_LINE_LENGTH) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function createPageContent(lines: string[]): Buffer {
  const commands = [
    "BT",
    `/F1 ${FONT_SIZE} Tf`,
    `${PAGE_MARGIN} ${PAGE_HEIGHT - PAGE_MARGIN} Td`,
  ];

  lines.forEach((line, index) => {
    commands.push(`${escapePdfString(line)} Tj`);
    if (index < lines.length - 1) commands.push(`0 -${LINE_HEIGHT} Td`);
  });

  commands.push("ET");
  return Buffer.from(`${commands.join("\n")}\n`, "latin1");
}

export function createCommitmentTermPdf(content: string): Uint8Array {
  const lines = content.split(/\r?\n/).flatMap(wrapLine);
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(lines.length / LINES_PER_PAGE)) },
    (_, index) =>
      createPageContent(
        lines.slice(index * LINES_PER_PAGE, (index + 1) * LINES_PER_PAGE)
      )
  );
  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  const contentObjectIds = pages.map((_, index) => 5 + index * 2);
  const objectCount = 3 + pages.length * 2;
  const chunks: Buffer[] = [
    Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1"),
  ];
  const offsets = Array<number>(objectCount + 1).fill(0);

  const appendObject = (id: number, body: Buffer) => {
    offsets[id] = Buffer.concat(chunks).byteLength;
    chunks.push(
      Buffer.from(`${id} 0 obj\n`, "ascii"),
      body,
      Buffer.from("\nendobj\n", "ascii")
    );
  };

  appendObject(
    1,
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "ascii")
  );
  appendObject(
    2,
    Buffer.from(
      `<< /Type /Pages /Kids [${pageObjectIds
        .map((id) => `${id} 0 R`)
        .join(" ")}] /Count ${pages.length} >>`,
      "ascii"
    )
  );
  appendObject(
    3,
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "ascii"
    )
  );

  pages.forEach((pageContent, index) => {
    appendObject(
      pageObjectIds[index],
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectIds[index]} 0 R >>`,
        "ascii"
      )
    );
    appendObject(
      contentObjectIds[index],
      Buffer.concat([
        Buffer.from(`<< /Length ${pageContent.byteLength} >>\nstream\n`, "ascii"),
        pageContent,
        Buffer.from("endstream", "ascii"),
      ])
    );
  });

  const xrefOffset = Buffer.concat(chunks).byteLength;
  const xref = [
    `xref\n0 ${objectCount + 1}`,
    "0000000000 65535 f ",
    ...offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
  ].join("\n");
  chunks.push(
    Buffer.from(
      `${xref}\ntrailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
      "ascii"
    )
  );

  return Buffer.concat(chunks);
}
