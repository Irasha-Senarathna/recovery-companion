import { historyOf, planSend, type Entry } from '../chat';

describe('planSend', () => {
  it('keeps crisis words on the phone (safety rule 4)', () => {
    expect(planSend('  I want to end my life ')).toEqual({
      action: 'crisis',
      message: 'I want to end my life',
    });
    expect(planSend('මට මැරෙන්න ඕනේ').action).toBe('crisis');
  });

  it('sends everyday messages, trimmed', () => {
    expect(planSend(' I feel lonely ')).toEqual({ action: 'send', message: 'I feel lonely' });
  });

  it('sends nothing for an empty message', () => {
    expect(planSend('   ').action).toBe('none');
  });
});

describe('historyOf', () => {
  it('includes only sent messages and the coach’s own replies', () => {
    const entries: Entry[] = [
      { id: 0, from: 'user', text: 'kept on phone', sent: false },
      { id: 1, from: 'coach', reply: { kind: 'crisis', topic: null, text: null, reachOut: false } },
      { id: 2, from: 'user', text: 'hello', sent: true },
      { id: 3, from: 'coach', reply: { kind: 'reply', topic: null, text: 'hi', reachOut: false } },
      { id: 4, from: 'error', kind: 'offline' },
      {
        id: 5,
        from: 'coach',
        reply: { kind: 'refusal', topic: 'dosing', text: null, reachOut: false },
      },
    ];
    expect(historyOf(entries)).toEqual([
      { role: 'user', text: 'hello' },
      { role: 'coach', text: 'hi' },
    ]);
  });
});
