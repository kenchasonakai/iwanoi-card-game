// 日本語の折り返し。Phaser の折り返しは禁則を見ないので、
// 行頭に句読点や閉じかっこを置かない、数字や英字の途中で折らない、だけを守る。

/** 行頭に来てはいけない文字。前の行の末尾にぶら下げる */
const NO_START = new Set([..."、。，．,.・：；？！?!ー〜」』）)】〕ゃゅょっぁぃぅぇぉャュョッァィゥェォ々%％"]);
/** 行末に来てはいけない文字。次の行へ送る */
const NO_END = new Set([..."「『（(【〔"]);

let ctx: CanvasRenderingContext2D | null = null;

function measurer(font: string) {
  ctx ??= document.createElement("canvas").getContext("2d");
  ctx!.font = font;
  return (s: string) => ctx!.measureText(s).width;
}

/** 折り返しの単位に分ける。英数字の並びは 1 つにまとめ、続く単位（倍、両、枚など）もくっつける */
function units(line: string): string[] {
  return line.match(/[A-Za-z0-9.,%×+\-−/:]+[倍両枚人回目年歳種位]?|./gu) ?? [];
}

export function wrapJa(text: string, width: number, font: string): string[] {
  const w = measurer(font);
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const u of units(para)) {
      if (cur === "" || w(cur + u) <= width || NO_START.has(u[0]!)) {
        cur += u;
        continue;
      }
      // 行末に開きかっこが残るなら、それごと次の行へ
      const last = [...cur].pop()!;
      if (NO_END.has(last) && cur.length > 1) {
        out.push(cur.slice(0, -last.length));
        cur = last + u;
      } else {
        out.push(cur);
        cur = u;
      }
    }
    out.push(cur);
  }
  return out;
}
