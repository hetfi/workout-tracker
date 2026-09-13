export type MuscleCategory = 'chest' | 'shoulder' | 'arm' | 'back' | 'leg' | 'ab' | 'cardio';

export const CATEGORY_COLORS: Record<MuscleCategory, string> = {
  chest:    '#EF4444',  // 胸 - red
  shoulder: '#F97316',  // 肩 - orange
  arm:      '#A855F7',  // 腕 - purple
  back:     '#3B82F6',  // 背 - blue
  leg:      '#22C55E',  // 脚 - green
  ab:       '#06B6D4',  // 腹 - cyan
  cardio:   '#EAB308',  // 有酸素 - yellow
};

export const CATEGORY_LABELS: Record<MuscleCategory, string> = {
  chest:    '胸',
  shoulder: '肩',
  arm:      '腕',
  back:     '背',
  leg:      '脚',
  ab:       '腹',
  cardio:   '有酸素',
};

const PATTERNS: Array<{ category: MuscleCategory; pattern: RegExp }> = [
  { category: 'chest',    pattern: /ベンチ|チェスト|フライ|プッシュアップ|ディップ|大胸筋|胸筋/ },
  { category: 'shoulder', pattern: /ショルダー|サイドレイズ|フロントレイズ|リアデルト|アップライトロウ|三角筋|ショルダープレス/ },
  { category: 'arm',      pattern: /カール|トライセプス|プレスダウン|ハンマー|バイセプス|上腕二頭|上腕三頭/ },
  { category: 'back',     pattern: /ロウ|ラットプル|デッドリフト|チンアップ|プルアップ|懸垂|広背筋|背中|シーテッド/ },
  { category: 'leg',      pattern: /スクワット|レッグ|ランジ|カーフ|ハムストリング|大腿|ふくらはぎ|大殿筋|ヒップ/ },
  { category: 'ab',       pattern: /クランチ|腹筋|プランク|レッグレイズ|腹/ },
  { category: 'cardio',   pattern: /ランニング|ジョギング|サイクル|エアロバイク|ウォーキング|有酸素|ローイング/ },
];

export function classifyExercise(name: string): MuscleCategory {
  for (const { category, pattern } of PATTERNS) {
    if (pattern.test(name)) return category;
  }
  return 'back';
}

export function getSessionCategories(names: string[]): MuscleCategory[] {
  const set = new Set(names.map(classifyExercise));
  const order: MuscleCategory[] = ['chest', 'shoulder', 'arm', 'back', 'leg', 'ab', 'cardio'];
  return order.filter((c) => set.has(c));
}
