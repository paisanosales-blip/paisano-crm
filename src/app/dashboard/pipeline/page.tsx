'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { opportunities as initialOpportunities, clients } from '@/lib/data';
import type { Opportunity, OpportunityStage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

const stages: OpportunityStage[] = ['Prospect', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);

  const handleStageChange = (opportunityId: string, newStage: OpportunityStage) => {
    setOpportunities(prev =>
      prev.map(op => (op.id === opportunityId ? { ...op, stage: newStage } : op))
    );
  };

  return (
    <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-headline font-bold">Sales Pipeline</h1>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Opportunity
            </Button>
        </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-start overflow-x-auto">
        {stages.map(stage => (
          <div key={stage} className="bg-muted/50 rounded-lg h-full min-w-[280px]">
            <h2 className="p-4 text-lg font-semibold font-headline sticky top-0 bg-muted/80 backdrop-blur-sm z-10 rounded-t-lg">{stage}</h2>
            <div className="p-2 flex flex-col gap-4">
              {opportunities
                .filter(op => op.stage === stage)
                .map(op => {
                  const client = clients.find(c => c.id === op.clientId);
                  return (
                    <Card key={op.id} className="shadow-md hover:shadow-lg transition-shadow">
                      <CardHeader className="p-4">
                        <CardTitle className="text-base">{op.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 text-sm space-y-2">
                        <p className="text-muted-foreground">{client?.nombreDelCliente}</p>
                        <p className="font-semibold">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: op.currency }).format(op.value)}
                        </p>
                        <Select value={op.stage} onValueChange={(newStage: OpportunityStage) => handleStageChange(op.id, newStage)}>
                          <SelectTrigger className="mt-2 h-8 text-xs">
                            <SelectValue placeholder="Change stage" />
                          </SelectTrigger>
                          <SelectContent>
                            {stages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
