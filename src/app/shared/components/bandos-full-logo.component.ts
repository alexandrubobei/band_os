import { Component, Input } from '@angular/core';

@Component({
  selector: 'bandos-full-logo',
  standalone: true,
  template: `
    <img
      [src]="src"
      [alt]="alt"
      [style.width.px]="width"
      [style.height.px]="height"
      style="display:block;object-fit:contain;" />
  `,
})
export class BandosFullLogoComponent {
  @Input() width = 320;
  @Input() height = 132;
  @Input() alt = 'BandOS';
  src = 'branding/bandos_logo_full.png';
}

@Component({
  selector: 'bandos-mark-logo',
  standalone: true,
  template: `<img [src]="src" alt="BandOS" [style.width.px]="size" [style.height.px]="size" style="display:block;object-fit:contain;" />`,
})
export class BandosMarkLogoComponent {
  @Input() size = 48;
  src = 'branding/bandos_logo_mark.png';
}
