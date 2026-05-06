import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, computed, signal } from '@angular/core';

const W = 640;
const H = 200;

@Component({
  selector: 'app-sales-trend-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sales-trend-chart.component.html',
  styleUrls: ['./sales-trend-chart.component.css'],
})
export class SalesTrendChartComponent {
  @Input() trend: any[] = [];
  @Input() formatDateLabel: ((value: string) => string) | null = null;

  readonly hoverIdx = signal<number | null>(null);

  readonly model = computed(() => {
    const trend = this.trend ?? [];
    const n = trend.length;
    if (n === 0) {
      return { points: [], pathLine: '', pathArea: '', labelStep: 1, padL: 44, padT: 16, innerW: 1, innerH: 1, baseY: 160 };
    }

    const values = trend.map((item) => Number(item.quantitySold ?? 0));
    const maxY = Math.max(...values, 0.0001);
    const padL = 44;
    const padR = 12;
    const padT = 16;
    const padB = 40;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    const points = trend.map((item, index) => {
      const x = n === 1 ? padL + innerW / 2 : padL + (index / (n - 1)) * innerW;
      const value = Number(item.quantitySold ?? 0);
      const y = padT + innerH - (value / maxY) * innerH;
      return { x, y, v: value, day: item.day };
    });

    const pathLine = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    const baseY = padT + innerH;
    const pathArea = `M ${points[0].x} ${baseY} L ${points.map((point) => `${point.x} ${point.y}`).join(' L ')} L ${points[points.length - 1].x} ${baseY} Z`;
    const labelStep = n <= 12 ? 1 : Math.ceil(n / 12);

    return { points, pathLine, pathArea, labelStep, padL, padT, innerW, innerH, baseY };
  });

  get hoveredPoint() {
    const hoverIdx = this.hoverIdx();
    return hoverIdx != null ? this.model().points[hoverIdx] : null;
  }

  @HostListener('mouseleave')
  clearHover() {
    this.hoverIdx.set(null);
  }

  updateHover(event: MouseEvent, svgElement: Element | null) {
    if (!svgElement || this.model().points.length === 0) return;
    const rect = svgElement.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;

    this.model().points.forEach((point, index) => {
      const distance = Math.abs(point.x - svgX);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });

    this.hoverIdx.set(nearest);
  }

  formatLabel(value: string) {
    return this.formatDateLabel ? this.formatDateLabel(value) : String(value);
  }
}
