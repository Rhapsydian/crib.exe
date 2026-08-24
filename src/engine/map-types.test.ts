import { describe, it, expect } from 'vitest';
import { createNode, type NodeType } from './map-types';

describe('createNode', () => {
  it('starts unresolved for every encounter-bearing node type', () => {
    const encounterTypes: NodeType[] = ['regularFight', 'gatekeeperFight', 'safehouse', 'shop', 'event'];
    for (const type of encounterTypes) {
      expect(createNode('n1', type).state).toBe('unresolved');
    }
  });

  it('starts a relay node already inert -- no encounter to resolve', () => {
    expect(createNode('n1', 'relay').state).toBe('inert');
  });

  it('preserves the id and type it was given', () => {
    expect(createNode('gatekeeper-0', 'gatekeeperFight')).toEqual({
      id: 'gatekeeper-0',
      type: 'gatekeeperFight',
      state: 'unresolved',
    });
  });
});
