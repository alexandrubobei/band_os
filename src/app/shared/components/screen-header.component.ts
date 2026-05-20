import { Component, Input } from '@angular/core';

@Component({
  selector: 'screen-header',
  standalone: true,
  template: `
    <div class="bandos-screen-header">
      <h1 class="bandos-screen-title">{{ title }}</h1>
      @if (subtitle) { <p class="bandos-screen-subtitle">{{ subtitle }}</p> }
    </div>
  `,
})
export class ScreenHeaderComponent {
  @Input() title = '';
  @Input() subtitle?: string;
}
