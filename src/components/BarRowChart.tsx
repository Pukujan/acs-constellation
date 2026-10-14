import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer } from "@/components/ui/chart";
import { layerHex, type ResearchChart } from "@/lib/content";

interface Props {
  componentId: string;
  rows: { name: string; value: number }[];
  unit: string;
  referenceLine?: number;
  max?: number;
}

export default function BarRowChart({
  componentId,
  rows,
  unit,
  referenceLine,
  max,
}: Props) {
  // Every series color comes from the Mona ramp in src/lib/content.ts.
  const color = layerHex(componentId);
  const upper = max ?? Math.max(...rows.map((r) => r.value)) * 1.25;
  const config = {
    value: { label: unit, color },
  };

  return (
    <ChartContainer
      config={config}
      className="min-h-[240px] w-full aspect-auto"
    >
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 52, bottom: 4, left: 4 }}
        barCategoryGap="26%"
      >
        <XAxis
          type="number"
          domain={[0, Math.ceil(upper)]}
          tickCount={4}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={118}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
        />
        {typeof referenceLine === "number" && (
          <ReferenceLine
            x={referenceLine}
            stroke="hsl(var(--gold))"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
          />
        )}
        <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false} maxBarSize={26}>
          {rows.map((row) => (
            <Cell key={row.name} fill={color} fillOpacity={0.85} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(value: number) =>
              unit === "%" ? `${value}%` : `${value} ${unit}`
            }
            style={{
              fill: "hsl(var(--gold-soft))",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
          />
        </Bar>
        {/*
          No hover tooltip: every value is already printed at the end of its
          bar, so a box that follows the cursor would only cover the chart.
        */}
      </BarChart>
    </ChartContainer>
  );
}

export function chartRows(chart: ResearchChart) {
  if (chart.groups) {
    return chart.groups.map((g) => ({ name: g.label, value: g.value }));
  }
  return (chart.rows ?? []).map((r) => ({ name: r.label, value: r.value }));
}
