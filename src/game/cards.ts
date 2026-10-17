// カードの定義。数字はすべて design.md の「カード一覧（仮の数字）」に従う。
// ここには Phaser も DOM も持ち込まない。

export type Rice = "山田錦" | "五百万石" | "総の舞" | "きたしずく" | "愛山";
export type Material = Rice | "麹" | "酵母";

export const RICES: readonly Rice[] = ["山田錦", "五百万石", "総の舞", "きたしずく", "愛山"];
export const isRice = (m: Material): m is Rice => (RICES as readonly string[]).includes(m);

/** 山札の枚数 */
export const DECK: Record<Material, number> = {
  山田錦: 8, 五百万石: 7, 総の舞: 5, きたしずく: 5, 愛山: 3, 麹: 14, 酵母: 10,
};

/** 取引先で買うときの値段（両） */
export const PRICE: Record<Material, number> = {
  山田錦: 2, 五百万石: 1, 総の舞: 1, きたしずく: 1, 愛山: 1, 麹: 1, 酵母: 1,
};

export type SakeId =
  | "gohyaku" | "fusa" | "aiyama" | "kita" | "karakuchi"
  | "yamahai240" | "daiginjo" | "nakagumi" | "koshu20" | "heiwa";

export type Specialist = "酛屋" | "船頭" | "蔵守";
export type Ability = "麹屋" | "仕入れ係" | "帳場" | "営業";
export type Role = "蔵人" | Specialist | Ability;

export type Needs = Partial<Record<Material, number>> & { ANY?: number };

export interface Sake {
  id: SakeId;
  name: string;
  /** 酒の場の札に載せる 1 行の名前 */
  short: string;
  /** 大きな札のラベル。省くと名前を空白で分け、前を上の小さな字、後ろを縦書きにする */
  label?: { head: string; body: string };
  needs: Needs;
  gauge: number;
  revenue: number;
  spec: Specialist;
  tags: readonly string[];
  say: string;
}

export const SAKES: readonly Sake[] = [
  { id: "gohyaku", name: "i240 五百万石", short: "i240 五百万石", needs: { 五百万石: 1, 麹: 1, 酵母: 1 }, gauge: 2, revenue: 6, spec: "船頭", tags: ["i240"], say: "i240の原点。シェフが選ぶ美酒アワード2026のフレンチ部門で三つ星。" },
  { id: "fusa", name: "i240 総の舞", short: "i240 総の舞", needs: { 総の舞: 1, 麹: 1, 酵母: 1 }, gauge: 2, revenue: 7, spec: "船頭", tags: ["i240"], say: "千葉県でしか栽培されていない酒米「総の舞」で造る。" },
  { id: "aiyama", name: "i240 愛山", short: "i240 愛山", needs: { 愛山: 1, 麹: 1, 酵母: 1 }, gauge: 2, revenue: 8, spec: "船頭", tags: ["i240"], say: "希少な酒米。上品な甘みと果実の香り。" },
  { id: "kita", name: "i240 きたしずく", short: "i240 きたしずく", needs: { きたしずく: 1, 麹: 1, 酵母: 1 }, gauge: 2, revenue: 7, spec: "船頭", tags: ["i240", "夏酒"], say: "北海道の酒米「きたしずく」で造る、i240 の夏酒。" },
  { id: "karakuchi", name: "山廃純米辛口", short: "山廃純米辛口", needs: { ANY: 1, 麹: 1 }, gauge: 4, revenue: 12, spec: "酛屋", tags: ["山廃"], say: "冷やからお燗まで。全国燗酒コンテスト2021金賞。" },
  { id: "yamahai240", name: "i240 山廃・山田錦", short: "i240 山廃山田錦", needs: { 山田錦: 1, 麹: 1, 酵母: 1 }, gauge: 4, revenue: 12, spec: "酛屋", tags: ["i240", "山廃"], say: "i240 でただひとつの山廃仕込み。全国燗酒コンテスト2024金賞。" },
  { id: "daiginjo", name: "山廃純米大吟醸", short: "山廃純米大吟醸", needs: { 山田錦: 2, 麹: 1 }, gauge: 6, revenue: 18, spec: "酛屋", tags: ["山廃", "大吟醸"], say: "蔵でいちばん格の高い酒。パーカーポイントで95点。" },
  { id: "nakagumi", name: "純米大吟醸・山田錦30%・中汲み", short: "純米大吟醸 中汲み", label: { head: "純米大吟醸 山田錦30%", body: "中汲み" }, needs: { 山田錦: 3, 麹: 1 }, gauge: 6, revenue: 22, spec: "船頭", tags: ["山田錦30%"], say: "兵庫県産山田錦を30%まで磨き、搾りの中ほどを取り分けた酒。" },
  { id: "koshu20", name: "秘蔵古酒20年", short: "秘蔵古酒20年", needs: { ANY: 1, 麹: 1 }, gauge: 8, revenue: 22, spec: "蔵守", tags: ["古酒"], say: "20年以上の熟成。チーズやチョコレートにも合う。" },
  { id: "heiwa", name: "平・和の調べ", short: "平・和の調べ", needs: { ANY: 2, 麹: 1 }, gauge: 6, revenue: 16, spec: "蔵守", tags: ["古酒"], say: "6種の古酒をソムリエがブレンド。鴨のローストに。" },
];

export const SAKE: Record<SakeId, Sake> = Object.fromEntries(SAKES.map((s) => [s.id, s])) as Record<SakeId, Sake>;

export interface RoleDef {
  fee: number;
  kind: "any" | "spec" | "ability";
  /** 駒に書く 1 文字 */
  mark: string;
  effect: string;
  /** 盤面に載せる短い効果 */
  brief: string;
}

export const ROLES: Record<Role, RoleDef> = {
  蔵人: { fee: 2, kind: "any", mark: "蔵", effect: "どの酒でも1マス", brief: "どの酒も 1マス" },
  酛屋: { fee: 4, kind: "spec", mark: "酛", effect: "山廃の酒で2マス、ほかは0", brief: "山廃で 2マス" },
  船頭: { fee: 4, kind: "spec", mark: "船", effect: "i240（山廃・山田錦を除く）と中汲みで2マス、ほかは0", brief: "i240・中汲みで 2マス" },
  蔵守: { fee: 4, kind: "spec", mark: "守", effect: "古酒で2マス、ほかは0", brief: "古酒で 2マス" },
  麹屋: { fee: 4, kind: "ability", mark: "麹", effect: "仕込みの麹が1枚少なくて済む（1ターン1回）", brief: "麹が 1枚少なく" },
  仕入れ係: { fee: 4, kind: "ability", mark: "仕", effect: "毎ターン山札から1枚多く引く", brief: "毎ターン 1枚多く引く" },
  帳場: { fee: 4, kind: "ability", mark: "帳", effect: "取引先で1ターン1枚まで無料", brief: "1ターン 1枚無料" },
  営業: { fee: 4, kind: "ability", mark: "営", effect: "同じ酒の値下がりが1段ゆるい", brief: "値下がりがゆるい" },
};

/** 求人の山（16 枚）。名前と一言は架空。あとで生成 AI で作る候補 */
export const RECRUITS: readonly { role: Role; name: string; line: string }[] = [
  { role: "蔵人", name: "大原 拓", line: "夏は海の家、冬は蔵で働く" },
  { role: "蔵人", name: "勝浦 ひなた", line: "蔵見学で日本酒に目覚めた" },
  { role: "蔵人", name: "布施 健吾", line: "米農家。田んぼが休みの冬に" },
  { role: "蔵人", name: "鵜原 奈央", line: "去年まで東京で会社員" },
  { role: "蔵人", name: "岩和田 大地", line: "地元の高校を出たばかり" },
  { role: "蔵人", name: "白浜 律", line: "体を動かすのが好き" },
  { role: "酛屋", name: "関 正造", line: "山廃の酛を育てて三十年" },
  { role: "酛屋", name: "堀田 早苗", line: "酛は子育てと同じ、が口癖" },
  { role: "船頭", name: "浜野 修", line: "搾りの加減は手で覚えた" },
  { role: "船頭", name: "川名 透", line: "槽口から目を離さない" },
  { role: "蔵守", name: "古川 静", line: "古いタンクの顔色が分かる" },
  { role: "蔵守", name: "蔵持 栄一", line: "二十年ものの酒の番人" },
  { role: "麹屋", name: "網代 みのり", line: "麹室の温度は肌で分かる" },
  { role: "仕入れ係", name: "部原 佑", line: "米農家との付き合いが長い" },
  { role: "帳場", name: "浪花 智子", line: "帳簿は蔵の体温計" },
  { role: "営業", name: "須賀 翔", line: "東京の酒屋を毎週まわる" },
];

export type EventKind = "嬉しいこと" | "トラブル" | "選ぶ札";

/** 「次に出荷する酒」にかかる効果 */
export interface Buff {
  kind: "mult" | "add";
  value: number;
  /** このタグを持つ酒だけ */
  tag?: string;
  /** この酒だけ */
  only?: SakeId;
  label: string;
}

export type EventId =
  | "summit" | "bishu" | "kanzake" | "parker" | "crowd" | "nanbu" | "export" | "magazine" | "harvest" | "visit"
  | "riceup" | "breakdown" | "typhoon" | "quit" | "badkoji"
  | "interview" | "newrice" | "tasting";

export interface GameEvent {
  id: EventId;
  kind: EventKind;
  weight: number;
  title: string;
  effect: string;
  origin: string;
  buff?: Buff;
}

export const EVENTS: readonly GameEvent[] = [
  { id: "summit", kind: "嬉しいこと", weight: 1, title: "サミットの乾杯酒", effect: "次に出荷する酒の売上が1.5倍", origin: "1986年の東京サミットの晩餐会で乾杯酒に選ばれた", buff: { kind: "mult", value: 1.5, label: "次の出荷 ×1.5" } },
  { id: "bishu", kind: "嬉しいこと", weight: 1, title: "美酒アワードの三つ星", effect: "次に出荷するi240の売上が1.5倍", origin: "i240 五百万石が「シェフが選ぶ美酒アワード2026」のフレンチ部門で三つ星", buff: { kind: "mult", value: 1.5, tag: "i240", label: "次のi240 ×1.5" } },
  { id: "kanzake", kind: "嬉しいこと", weight: 1, title: "燗酒コンテスト金賞", effect: "次に出荷する山廃の酒の売上が1.5倍", origin: "山廃純米辛口（2021年）とi240 山廃・山田錦（2024年）が金賞", buff: { kind: "mult", value: 1.5, tag: "山廃", label: "次の山廃 ×1.5" } },
  { id: "parker", kind: "嬉しいこと", weight: 1, title: "パーカーポイント95点", effect: "次に出荷する山廃純米大吟醸の売上が2倍", origin: "山廃純米大吟醸がパーカーポイントで95点", buff: { kind: "mult", value: 2, only: "daiginjo", label: "次の大吟醸 ×2" } },
  { id: "crowd", kind: "嬉しいこと", weight: 1, title: "クラファン大成功", effect: "好きな素材を2枚、無料でもらえる", origin: "2026年、Makuakeでのヴィンテージ古酒のクラウドファンディングが、目標30万円に対し約229万円を集めた" },
  { id: "nanbu", kind: "嬉しいこと", weight: 2, title: "南部から応援", effect: "このターンだけ蔵人が1人増える（給料なし）", origin: "10月から4月の仕込みに、南部から蔵人が来ている（2024年の取材）" },
  { id: "export", kind: "嬉しいこと", weight: 2, title: "海外の商談がまとまる", effect: "すぐ5両もらう", origin: "海外への出荷に取り組んでいる" },
  { id: "magazine", kind: "嬉しいこと", weight: 2, title: "雑誌に載る", effect: "次に出荷する酒の売上が3両増える", origin: "架空", buff: { kind: "add", value: 3, label: "次の出荷 +3両" } },
  { id: "harvest", kind: "嬉しいこと", weight: 2, title: "米がよく取れた", effect: "山札から2枚引く", origin: "架空" },
  { id: "visit", kind: "嬉しいこと", weight: 2, title: "蔵見学のお客さん", effect: "すぐ2両もらう", origin: "架空" },
  { id: "riceup", kind: "トラブル", weight: 2, title: "酒米の値上がり", effect: "3ターンの間、取引先の米が2倍", origin: "2026年、酒米の価格が2倍近くに上がった" },
  { id: "breakdown", kind: "トラブル", weight: 2, title: "機械の故障", effect: "2両払うか、マスを1つ戻すかを選ぶ", origin: "架空" },
  { id: "typhoon", kind: "トラブル", weight: 2, title: "台風で停電", effect: "このターン、置ける人が1人減る", origin: "架空" },
  { id: "quit", kind: "トラブル", weight: 2, title: "離職", effect: "一番最近雇った人が辞める", origin: "架空" },
  { id: "badkoji", kind: "トラブル", weight: 1, title: "麹の出来が悪い", effect: "手札の麹を1枚捨てる", origin: "架空" },
  { id: "interview", kind: "選ぶ札", weight: 2, title: "取材の依頼", effect: "受けると置ける人が1人減り、次の出荷が+4両", origin: "架空" },
  { id: "newrice", kind: "選ぶ札", weight: 2, title: "新しい酒米の提案", effect: "3両払えば、好きな米を2枚もらえる", origin: "架空" },
  { id: "tasting", kind: "選ぶ札", weight: 2, title: "試飲会への出店", effect: "2両払えば、次の出荷が1.5倍", origin: "架空" },
];

export const TURNS = 20;
export const HAND_MAX = 5;
export const BREW_MAX = 3;
export const SALARY = 1;
export const START_MONEY = 12;
export const BUYS_PER_TURN = 2;
export const REFRESH_FEE = 1;
export const FIELD_SIZE = 3;

/** ランクの目安。仮の数字 */
export const RANKS: readonly [number, string][] = [[170, "S"], [140, "A"], [110, "B"], [-Infinity, "C"]];

/** 専門職がその酒で 2 マス埋められるか */
export function specialistWorks(role: Role, sake: Sake): boolean {
  return sake.spec === role;
}
