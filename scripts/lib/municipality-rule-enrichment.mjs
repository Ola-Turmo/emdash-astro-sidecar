import { normalizeText } from './municipality-evidence.mjs';

export function enrichMunicipalityRules({
  alcoholServingRules = [],
  openingHoursRules = [],
}) {
  const normalizedOpeningRules = openingHoursRules.map((rule) => normalizeOpeningRule(rule));
  const normalizedServingRules = alcoholServingRules.map((rule) => normalizeServingRule(rule));

  const explicitRules = normalizedServingRules.flatMap((rule) =>
    expandServingRuleFromExplicitNote(rule, normalizedOpeningRules),
  );
  const fallbackRules = normalizedServingRules.map((rule) =>
    fillServingRuleFromOpeningHints(rule, normalizedOpeningRules),
  );

  return {
    alcoholServingRules: dedupeServingRules([...fallbackRules, ...explicitRules]),
    openingHoursRules: normalizedOpeningRules,
  };
}

function normalizeOpeningRule(rule) {
  return {
    ...rule,
    appliesTo: normalizeText(rule.applies_to || rule.appliesTo || ''),
    days: normalizeText(rule.days || ''),
    startTime: normalizeClock(rule.start_time || rule.startTime || ''),
    endTime: normalizeClock(rule.end_time || rule.endTime || ''),
    note: normalizeText(rule.note || ''),
  };
}

function normalizeServingRule(rule) {
  return {
    ...rule,
    days: normalizeText(rule.days || ''),
    startTime: normalizeClock(rule.start_time || rule.startTime || ''),
    endTime: normalizeClock(rule.end_time || rule.endTime || ''),
    note: normalizeText(rule.note || ''),
    groups: Array.isArray(rule.alcohol_groups)
      ? [...new Set(rule.alcohol_groups.map((entry) => String(entry)))]
      : Array.isArray(rule.groups)
        ? [...new Set(rule.groups.map((entry) => String(entry)))]
      : [],
  };
}

function expandServingRuleFromExplicitNote(rule, openingHoursRules) {
  if (rule.startTime && rule.endTime) {
    return [rule];
  }

  const note = normalizeText(rule.note || '');
  if (!note) {
    return [rule];
  }

  const explicitRules = extractExplicitTimedRules(rule, note, openingHoursRules);
  return explicitRules.length ? explicitRules : [rule];
}

function fillServingRuleFromOpeningHints(rule, openingHoursRules) {
  if (rule.endTime || !rule.groups.length) {
    return rule;
  }

  const hint = openingHoursRules.find((openingRule) =>
    /\bskjenkeslutt\b/i.test(openingRule.note || ''),
  );
  if (!hint) {
    return rule;
  }

  const time = normalizeClock(
    hint.note.match(/skjenkeslutt[^0-9]*(\d{1,2}[:.]\d{2})/iu)?.[1] ||
      hint.note.match(/\(kl\.\s*(\d{1,2}[:.]\d{2})\)/iu)?.[1] ||
      '',
  );
  if (!time) {
    return rule;
  }

  return {
    ...rule,
    days: rule.days || hint.days || '',
    endTime: time,
  };
}

function dedupeServingRules(rules) {
  const superseded = new Set();
  for (let index = 0; index < rules.length; index += 1) {
    const current = rules[index];
    for (let candidateIndex = 0; candidateIndex < rules.length; candidateIndex += 1) {
      if (index === candidateIndex) continue;
      const candidate = rules[candidateIndex];
      if (!sameRuleFamily(current, candidate)) continue;
      if (ruleSpecificity(candidate) > ruleSpecificity(current)) {
        superseded.add(index);
        break;
      }
    }
  }

  const seen = new Set();
  return rules.filter((rule, index) => {
    if (superseded.has(index)) {
      return false;
    }
    const key = [
      normalizeText(rule.area || ''),
      (rule.groups || []).join(','),
      normalizeText(rule.days || ''),
      normalizeClock(rule.startTime || ''),
      normalizeClock(rule.endTime || ''),
      normalizeText(rule.note || ''),
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractExplicitTimedRules(rule, note, openingHoursRules) {
  const explicitRules = [];
  const pushRule = (nextRule) => {
    if (!nextRule?.endTime) return;
    explicitRules.push({
      ...rule,
      ...nextRule,
      days: normalizeText(nextRule.days || rule.days || ''),
      startTime: normalizeClock(nextRule.startTime || rule.startTime || ''),
      endTime: normalizeClock(nextRule.endTime || rule.endTime || ''),
      note,
      groups: Array.isArray(nextRule.groups) && nextRule.groups.length ? nextRule.groups : rule.groups,
      area: nextRule.area || rule.area,
    });
  };

  const directUnderOver = note.match(
    /skjenking\s*(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})\s*\(under\s*22%[^)]*\)\s*\/\s*(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})\s*\(over\s*22%[^)]*\)/iu,
  );
  if (directUnderOver) {
    pushRule({ groups: ['1', '2'], startTime: directUnderOver[1], endTime: directUnderOver[2] });
    pushRule({ groups: ['3'], startTime: directUnderOver[3], endTime: directUnderOver[4] });
  }

  const scheduledElseRule = note.match(
    /(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})\s*\(([^)]+)\)\s*,?\s*ellers\s*(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})/iu,
  );
  if (scheduledElseRule && rule.groups.length) {
    pushRule({
      groups: rule.groups,
      startTime: scheduledElseRule[1],
      endTime: scheduledElseRule[2],
      days: scheduledElseRule[3],
    });
    pushRule({
      groups: rule.groups,
      startTime: scheduledElseRule[4],
      endTime: scheduledElseRule[5],
      days: 'Øvrige dager',
    });
  }

  for (const match of note.matchAll(
    /(?:gruppe|gr)\s*([1-3])\s*-\s*([1-3])[^.]*?(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})/giu,
  )) {
    pushRule({
      groups: expandGroupRange(String(match[1] || ''), String(match[2] || '')),
      startTime: match[3],
      endTime: match[4],
    });
  }

  for (const match of note.matchAll(
    /(?:gruppe|gr)\s*([1-3])\s*-\s*([1-3])[^.]*?\btil\b[^0-9]*(\d{1,2}[:.]\d{2})/giu,
  )) {
    pushRule({
      groups: expandGroupRange(String(match[1] || ''), String(match[2] || '')),
      endTime: match[3],
    });
  }

  for (const match of note.matchAll(
    /(?:gruppe|gr)\s*([1-3])[^-.0-9]*\btil\b[^0-9]*(\d{1,2}[:.]\d{2})/giu,
  )) {
    pushRule({
      groups: [String(match[1] || '')].filter(Boolean),
      endTime: match[2],
    });
  }

  const wineBeerRange = note.match(/øl og vin[^.]*?(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})/iu);
  if (wineBeerRange) {
    pushRule({ groups: ['1', '2'], startTime: wineBeerRange[1], endTime: wineBeerRange[2] });
  }

  const spiritRange = note.match(/brennevin[^.]*?(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})/iu);
  if (spiritRange) {
    pushRule({ groups: ['3'], startTime: spiritRange[1], endTime: spiritRange[2] });
  }

  if (/\bgenerelt\b/iu.test(note) && rule.groups.length) {
    const genericRange = note.match(/(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})/u);
    if (genericRange) {
      pushRule({ groups: rule.groups, startTime: genericRange[1], endTime: genericRange[2] });
    }
  }

  const directRange = note.match(/(\d{1,2}[:.]\d{2})\s*-\s*(\d{1,2}[:.]\d{2})/u);
  if (directRange && rule.groups.length && !explicitRules.length) {
    pushRule({ groups: rule.groups, startTime: directRange[1], endTime: directRange[2] });
  }

  const directTime = normalizeClock(note.match(/\btil\b[^0-9]*(\d{1,2}[:.]\d{2})/iu)?.[1] || '');
  if (directTime && rule.groups.length && !explicitRules.length) {
    pushRule({
      groups: rule.groups,
      endTime: directTime,
    });
  }

  if (!explicitRules.length) {
    const derivedTime = deriveServingEndTimeFromOpeningRules(rule, openingHoursRules);
    if (derivedTime && rule.groups.length) {
      pushRule({
        groups: rule.groups,
        days: derivedTime.days,
        endTime: derivedTime.endTime,
      });
    }
  }

  return explicitRules;
}

function deriveServingEndTimeFromOpeningRules(rule, openingHoursRules) {
  const note = normalizeText(rule.note || '');
  const hint = openingHoursRules.find(
    (openingRule) =>
      openingRule.endTime &&
      (/\bskjenkeslutt\b/i.test(openingRule.note || '') ||
        ((/holde åpent|kan holde åpent|åpent til|stengetid/iu.test(openingRule.note || '') &&
          !/\bstengt\b/iu.test(openingRule.note || '')) &&
          /30\s*min(?:utter)?/iu.test(note) &&
          /\bskjenkeslutt\b/iu.test(note))),
  );

  if (!hint) {
    return null;
  }

  const directHintTime = normalizeClock(
    hint.note.match(/skjenkeslutt[^0-9]*(\d{1,2}[:.]\d{2})/iu)?.[1] ||
      hint.note.match(/\(kl\.\s*(\d{1,2}[:.]\d{2})\)/iu)?.[1] ||
      '',
  );
  if (directHintTime) {
    return {
      days: hint.days || '',
      endTime: directHintTime,
    };
  }

  if (/30\s*min(?:utter)?/iu.test(note) && /\bskjenkeslutt\b/iu.test(note)) {
    const endTime = shiftClock(hint.endTime, -30);
    if (endTime) {
      return {
        days: hint.days || '',
        endTime,
      };
    }
  }

  return null;
}

function sameRuleIdentity(left, right) {
  return (
    normalizeText(left.area || '') === normalizeText(right.area || '') &&
    (left.groups || []).join(',') === (right.groups || []).join(',') &&
    normalizeText(left.days || '') === normalizeText(right.days || '') &&
    normalizeText(left.note || '') === normalizeText(right.note || '')
  );
}

function sameRuleFamily(left, right) {
  if (
    normalizeText(left.area || '') !== normalizeText(right.area || '') ||
    (left.groups || []).join(',') !== (right.groups || []).join(',') ||
    normalizeText(left.note || '') !== normalizeText(right.note || '')
  ) {
    return false;
  }

  const leftDays = normalizeText(left.days || '');
  const rightDays = normalizeText(right.days || '');
  return leftDays === rightDays || !leftDays || !rightDays;
}

function ruleSpecificity(rule) {
  return [rule.startTime, rule.endTime].filter(Boolean).length;
}

function expandGroupRange(start, end) {
  const low = Number(start);
  const high = Number(end);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) {
    return [start, end].filter(Boolean);
  }
  return Array.from({ length: high - low + 1 }, (_, index) => String(low + index));
}

function normalizeClock(value) {
  const normalized = normalizeText(value || '').replace('.', ':');
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function shiftClock(value, minutesDelta) {
  const normalized = normalizeClock(value);
  if (!normalized) return '';
  const [hours, minutes] = normalized.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';
  const shifted = ((hours * 60 + minutes + minutesDelta) % (24 * 60) + 24 * 60) % (24 * 60);
  const shiftedHours = Math.floor(shifted / 60);
  const shiftedMinutes = shifted % 60;
  return `${String(shiftedHours).padStart(2, '0')}:${String(shiftedMinutes).padStart(2, '0')}`;
}
