'use client';

import { Tabs, Tab, ORIENTATION } from 'baseui/tabs-motion';
import { useState } from 'react';
import { AdhocForm } from './adhoc-form';
import { PotBorrowForm } from './pot-borrow-form';
import { SplitForm } from './split-form';

type Member = { id: string; displayName: string };

export function NewChargeTabs({ members }: { members: Member[] }) {
  const [key, setKey] = useState<React.Key>('adhoc');
  return (
    <Tabs activeKey={key} onChange={({ activeKey }) => setKey(activeKey)} orientation={ORIENTATION.horizontal}>
      <Tab key="adhoc" title="Adhoc">
        <AdhocForm members={members} />
      </Tab>
      <Tab key="split" title="Split">
        <SplitForm members={members} />
      </Tab>
      <Tab key="pot_borrow" title="Pot borrow">
        <PotBorrowForm members={members} />
      </Tab>
    </Tabs>
  );
}
