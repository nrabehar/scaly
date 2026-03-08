import { Injectable } from '@nestjs/common';
import { ImpactLevel, INSTITUTIONAL_MAP } from './constants/impact';

// Build one compiled regex per ImpactLevel at module load time.
// Word-boundary anchors (\b) prevent false positives from short keys
// (e.g. 'fed' won't match "feared", 'ai' won't match "daily").
// Levels are sorted descending so we return early on the highest match.
const LEVEL_REGEXES: { level: ImpactLevel; regex: RegExp }[] = (() => {
    const groups = new Map<ImpactLevel, string[]>();
    for (const [key, level] of Object.entries(INSTITUTIONAL_MAP)) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!groups.has(level)) groups.set(level, []);
        groups.get(level)!.push(escaped);
    }
    return [
        ImpactLevel.CRITICAL,
        ImpactLevel.HIGH,
        ImpactLevel.MEDIUM,
        ImpactLevel.LOW,
    ]
        .filter((lvl) => groups.has(lvl))
        .map((lvl) => ({
            level: lvl,
            regex: new RegExp(`\\b(${groups.get(lvl)!.join('|')})\\b`, 'i'),
        }));
})();

@Injectable()
export class ImpactAnalyzer {
    analyze(title: string, description: string): ImpactLevel {
        const text = `${title} ${description}`;
        for (const { level, regex } of LEVEL_REGEXES) {
            if (regex.test(text)) return level;
        }
        return ImpactLevel.LOW;
    }
}
