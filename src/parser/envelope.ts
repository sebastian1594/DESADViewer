/**
 * UMSCHLAG – findet Übertragung (UNB…UNZ), Gruppen (UNG…UNE) und
 * Nachrichten (UNH…UNT) und prüft Zählungen und Referenzen.
 */
import { describeCode } from '../knowledge';
import { formatEdiDate } from './dates';
import type { GroupInfo, InterchangeInfo, Issue, MessageIdentifier, RawSegment } from './model';

export interface MessageEnvelope {
  reference: string;
  identifier: MessageIdentifier;
  /** Index des UNH-Segments */
  start: number;
  /** Index des UNT-Segments bzw. des letzten Segments der Nachricht */
  end: number;
  closed: boolean;
}

export interface EnvelopeResult {
  interchanges: InterchangeInfo[];
  groups: GroupInfo[];
  messages: MessageEnvelope[];
  issues: Issue[];
}

const get = (seg: RawSegment, el: number, comp = 0): string | undefined => {
  const v = seg.elements[el]?.[comp];
  return v === '' ? undefined : v;
};

function readIdentifier(unh: RawSegment): MessageIdentifier {
  return {
    type: get(unh, 1, 0) ?? '',
    version: get(unh, 1, 1) ?? '',
    release: get(unh, 1, 2) ?? '',
    agency: get(unh, 1, 3) ?? '',
    associationCode: get(unh, 1, 4),
    codeListVersion: get(unh, 1, 5),
    subsetId: get(unh, 4, 0),
    implementationGuide: get(unh, 5, 0),
  };
}

function readInterchange(unb: RawSegment): InterchangeInfo {
  const date = get(unb, 3, 0);
  const time = get(unb, 3, 1);
  let preparedAt;
  if (date) {
    const fmt = date.length === 8 ? (time ? '203' : '102') : time ? '201' : '101';
    preparedAt = formatEdiDate(date + (time ?? ''), fmt);
  }
  const sender = get(unb, 1, 0);
  const recipient = get(unb, 2, 0);
  return {
    syntax: describeCode('0001', get(unb, 0, 0)),
    syntaxVersion: get(unb, 0, 1),
    sender: sender ? { id: sender, qualifier: describeCode('0007', get(unb, 1, 1)) } : undefined,
    recipient: recipient ? { id: recipient, qualifier: describeCode('0007', get(unb, 2, 1)) } : undefined,
    preparedAt,
    controlRef: get(unb, 4),
    applicationRef: get(unb, 6),
    testIndicator: get(unb, 10) === '1',
    segmentIndex: unb.index,
    messageCount: 0,
    groupCount: 0,
  };
}

export function analyzeEnvelope(segments: RawSegment[]): EnvelopeResult {
  const issues: Issue[] = [];
  const interchanges: InterchangeInfo[] = [];
  const groups: GroupInfo[] = [];
  const messages: MessageEnvelope[] = [];

  let interchange: InterchangeInfo | undefined;
  let group: GroupInfo | undefined;
  let message: MessageEnvelope | undefined;
  const seenRefs = new Set<string>();
  let outsideWarned = false;

  // Nachricht ohne UNT schließen; message.end zeigt bereits auf ihr letztes Segment.
  const closeMessageWithoutTrailer = () => {
    if (!message) return;
    issues.push({
      severity: 'error',
      code: 'UNT_MISSING',
      message: `Nachricht „${message.reference}“ hat kein Ende-Segment (UNT). Sie wird trotzdem angezeigt, ist aber vermutlich unvollständig.`,
      segmentIndex: message.start,
      messageIndex: messages.length - 1,
    });
    message = undefined;
  };

  for (const seg of segments) {
    switch (seg.tag) {
      case 'UNA':
        break;

      case 'UNB':
        closeMessageWithoutTrailer();
        if (interchange) {
          issues.push({
            severity: 'warning',
            code: 'UNZ_MISSING',
            message: `Die Übertragung „${interchange.controlRef ?? '?'}“ hat kein Ende-Segment (UNZ), bevor eine neue beginnt.`,
            segmentIndex: interchange.segmentIndex,
          });
        }
        interchange = readInterchange(seg);
        interchanges.push(interchange);
        if (interchange.preparedAt && !interchange.preparedAt.valid) {
          issues.push({
            severity: 'warning',
            code: 'UNB_INVALID_DATE',
            message: `Erstellungsdatum im UNB: ${interchange.preparedAt.error}`,
            segmentIndex: seg.index,
          });
        }
        if (interchanges.length > 1) {
          issues.push({
            severity: 'info',
            code: 'MULTIPLE_INTERCHANGES',
            message: 'Die Datei enthält mehrere Übertragungen (mehrere UNB). Alle Nachrichten werden angezeigt.',
            segmentIndex: seg.index,
          });
        }
        break;

      case 'UNG':
        closeMessageWithoutTrailer();
        group = { groupId: get(seg, 0), reference: get(seg, 4), segmentIndex: seg.index, messageCount: 0 };
        groups.push(group);
        if (interchange) interchange.groupCount++;
        break;

      case 'UNE': {
        closeMessageWithoutTrailer();
        if (!group) {
          issues.push({ severity: 'warning', code: 'UNE_WITHOUT_UNG', message: 'Gruppen-Ende (UNE) ohne passenden Gruppen-Kopf (UNG).', segmentIndex: seg.index });
          break;
        }
        group.trailerIndex = seg.index;
        const declared = Number(get(seg, 0));
        if (get(seg, 0) !== undefined && declared !== group.messageCount) {
          issues.push({
            severity: 'warning',
            code: 'UNE_COUNT_MISMATCH',
            message: `UNE meldet ${get(seg, 0)} Nachrichten in der Gruppe, gefunden wurden ${group.messageCount}.`,
            segmentIndex: seg.index,
          });
        }
        if (get(seg, 1) !== group.reference) {
          issues.push({
            severity: 'warning',
            code: 'UNE_REF_MISMATCH',
            message: `Gruppenreferenz in UNE („${get(seg, 1) ?? ''}“) passt nicht zu UNG („${group.reference ?? ''}“).`,
            segmentIndex: seg.index,
          });
        }
        group = undefined;
        break;
      }

      case 'UNH': {
        closeMessageWithoutTrailer();
        const reference = get(seg, 0) ?? '';
        const identifier = readIdentifier(seg);
        message = { reference, identifier, start: seg.index, end: seg.index, closed: false };
        messages.push(message);
        const messageIndex = messages.length - 1;
        if (interchange) interchange.messageCount++;
        if (group) group.messageCount++;

        if (!reference) {
          issues.push({ severity: 'warning', code: 'UNH_NO_REF', message: 'Der Nachrichten-Kopf (UNH) hat keine Nachrichtenreferenz.', segmentIndex: seg.index, messageIndex });
        } else if (seenRefs.has(reference)) {
          issues.push({
            severity: 'warning',
            code: 'UNH_DUPLICATE_REF',
            message: `Die Nachrichtenreferenz „${reference}“ kommt mehrfach vor. Sie sollte innerhalb einer Übertragung eindeutig sein.`,
            segmentIndex: seg.index,
            messageIndex,
          });
        }
        seenRefs.add(reference);

        if (!identifier.type) {
          issues.push({ severity: 'error', code: 'UNH_NO_TYPE', message: 'Im UNH fehlt der Nachrichtentyp.', segmentIndex: seg.index, messageIndex });
        } else if (identifier.type !== 'DESADV') {
          issues.push({
            severity: 'warning',
            code: 'NOT_DESADV',
            message: `Diese Nachricht ist vom Typ „${identifier.type}“, nicht DESADV. Sie wird so gut wie möglich angezeigt.`,
            segmentIndex: seg.index,
            messageIndex,
          });
        }
        if (!identifier.version || !identifier.release) {
          issues.push({
            severity: 'warning',
            code: 'UNH_NO_VERSION',
            message: 'Im UNH fehlen Version und/oder Release (z. B. „D:96A“). Die Version kann nicht bestimmt werden.',
            segmentIndex: seg.index,
            messageIndex,
          });
        }
        break;
      }

      case 'UNT': {
        if (!message) {
          issues.push({ severity: 'error', code: 'UNT_WITHOUT_UNH', message: 'Nachrichten-Ende (UNT) ohne passenden Nachrichten-Kopf (UNH).', segmentIndex: seg.index });
          break;
        }
        const messageIndex = messages.length - 1;
        message.end = seg.index;
        message.closed = true;
        const actual = seg.index - message.start + 1;
        const declaredRaw = get(seg, 0);
        if (declaredRaw === undefined) {
          issues.push({ severity: 'warning', code: 'UNT_NO_COUNT', message: 'UNT enthält keine Segmentanzahl.', segmentIndex: seg.index, messageIndex });
        } else if (Number(declaredRaw) !== actual) {
          issues.push({
            severity: 'warning',
            code: 'UNT_COUNT_MISMATCH',
            message: `UNT meldet ${declaredRaw} Segmente, tatsächlich sind es ${actual} (UNH bis UNT mitgezählt). Möglicherweise fehlen Segmente oder die Datei wurde verändert.`,
            segmentIndex: seg.index,
            messageIndex,
          });
        }
        const ref = get(seg, 1);
        if (ref !== message.reference) {
          issues.push({
            severity: 'warning',
            code: 'UNT_REF_MISMATCH',
            message: `Die Referenz im UNT („${ref ?? ''}“) passt nicht zur Referenz im UNH („${message.reference}“).`,
            segmentIndex: seg.index,
            messageIndex,
          });
        }
        message = undefined;
        break;
      }

      case 'UNZ': {
        closeMessageWithoutTrailer();
        if (!interchange) {
          issues.push({ severity: 'warning', code: 'UNZ_WITHOUT_UNB', message: 'Nutzdaten-Ende (UNZ) ohne passenden Kopf (UNB).', segmentIndex: seg.index });
          break;
        }
        interchange.trailerIndex = seg.index;
        const declaredRaw = get(seg, 0);
        const expected = interchange.groupCount > 0 ? interchange.groupCount : interchange.messageCount;
        const what = interchange.groupCount > 0 ? 'Gruppen' : 'Nachrichten';
        if (declaredRaw !== undefined) interchange.declaredCount = Number(declaredRaw);
        if (declaredRaw === undefined) {
          issues.push({ severity: 'warning', code: 'UNZ_NO_COUNT', message: 'UNZ enthält keine Anzahl.', segmentIndex: seg.index });
        } else if (Number(declaredRaw) !== expected) {
          issues.push({
            severity: 'warning',
            code: 'UNZ_COUNT_MISMATCH',
            message: `UNZ meldet ${declaredRaw} ${what}, gefunden wurden ${expected}.`,
            segmentIndex: seg.index,
          });
        }
        const ref = get(seg, 1);
        if (ref !== interchange.controlRef) {
          issues.push({
            severity: 'warning',
            code: 'UNZ_REF_MISMATCH',
            message: `Die Referenz im UNZ („${ref ?? ''}“) passt nicht zur Referenz im UNB („${interchange.controlRef ?? ''}“).`,
            segmentIndex: seg.index,
          });
        }
        interchange = undefined;
        break;
      }

      default:
        if (message) {
          message.end = seg.index;
        } else if (!outsideWarned) {
          outsideWarned = true;
          issues.push({
            severity: 'warning',
            code: 'SEGMENT_OUTSIDE_MESSAGE',
            message: `Segment ${seg.tag} steht außerhalb einer Nachricht (nicht zwischen UNH und UNT). Solche Segmente werden nur in der Segmentansicht gezeigt.`,
            segmentIndex: seg.index,
          });
        }
    }
  }

  if (message) closeMessageWithoutTrailer();
  if (interchange) {
    issues.push({
      severity: 'warning',
      code: 'UNZ_MISSING',
      message: 'Die Übertragung hat kein Ende-Segment (UNZ). Die Datei ist evtl. unvollständig.',
      segmentIndex: interchange.segmentIndex,
    });
  }
  if (interchanges.length === 0 && messages.length > 0) {
    issues.push({
      severity: 'info',
      code: 'UNB_MISSING',
      message: 'Die Datei hat keinen Übertragungs-Kopf (UNB), sondern beginnt direkt mit der Nachricht. Das kommt vor, wenn nur die Nachricht exportiert wurde.',
    });
  }
  return { interchanges, groups, messages, issues };
}
