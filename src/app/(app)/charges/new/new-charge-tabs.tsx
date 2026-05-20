'use client';

import { Tabs, Tab, ORIENTATION } from 'baseui/tabs-motion';
import { useState } from 'react';
import { useMessages } from '@/app/_i18n-provider';
import { AdhocForm } from './adhoc-form';
import { PotBorrowForm } from './pot-borrow-form';
import { SplitForm } from './split-form';

type Member = { id: string; displayName: string };

export function NewChargeTabs({ members }: { members: Member[] }) {
  const m = useMessages();
  const [key, setKey] = useState<React.Key>('adhoc');
  return (
    <Tabs activeKey={key} onChange={({ activeKey }) => setKey(activeKey)} orientation={ORIENTATION.horizontal}>
      <Tab key="adhoc" title={m.charges.tabAdhoc}>
        <AdhocForm members={members} />
      </Tab>
      <Tab key="split" title={m.charges.tabSplit}>
        <SplitForm members={members} />
      </Tab>
      <Tab key="pot_borrow" title={m.charges.tabPotBorrow}>
        <PotBorrowForm members={members} />
      </Tab>
    </Tabs>
  );
}
