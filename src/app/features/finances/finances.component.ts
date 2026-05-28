import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'expense-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit expense' : 'New expense' }}</h2>
    <form mat-dialog-content [formGroup]="form" class="bandos-stack" style="min-width:420px;">
      <mat-form-field appearance="fill"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <div class="bandos-row">
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Amount</mat-label><input matInput type="number" formControlName="amount" /></mat-form-field>
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Date</mat-label><input matInput type="date" formControlName="date" /></mat-form-field>
      </div>
      <mat-form-field appearance="fill">
        <mat-label>Category</mat-label>
        <mat-select formControlName="category">
          @for (c of categories; track c) { <mat-option [value]="c">{{ catLabel(c) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Paid by</mat-label><input matInput formControlName="paidBy" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>
    </form>
    <div mat-dialog-actions align="end">
      @if (existing) { <button mat-button color="warn" style="margin-right: auto;" (click)="ref.close({ action: 'delete' })">Delete</button> }
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
})
export class ExpenseEditorDialog {
  ref = inject(MatDialogRef<ExpenseEditorDialog>);
  private readonly fb = inject(FormBuilder);
  data: { expense?: M.FinanceExpense } = inject<{ expense?: M.FinanceExpense }>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  existing = !!this.data.expense;
  categories = Object.values(M.FinanceExpenseCategory);
  catLabel(c: M.FinanceExpenseCategory) { return M.FinanceExpenseCategoryLabel[c]; }
  form = this.fb.nonNullable.group({
    title: [this.data.expense?.title ?? '', [Validators.required]],
    amount: [this.data.expense?.amount ?? 0, [Validators.required, Validators.min(0)]],
    date: [(this.data.expense?.date ?? new Date()).toISOString().substring(0, 10)],
    category: [this.data.expense?.category ?? M.FinanceExpenseCategory.other],
    paidBy: [this.data.expense?.paidBy ?? ''],
    notes: [this.data.expense?.notes ?? ''],
  });
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const expense: M.FinanceExpense = this.data.expense
      ? { ...this.data.expense, ...v, amount: Number(v.amount), date: new Date(v.date) }
      : { id: uuid(), ...v, amount: Number(v.amount), date: new Date(v.date) };
    this.ref.close({ action: 'save', expense });
  }
}

@Component({
  selector: 'income-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit income' : 'New income' }}</h2>
    <form mat-dialog-content [formGroup]="form" class="bandos-stack" style="min-width:420px;">
      <mat-form-field appearance="fill"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <div class="bandos-row">
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Amount</mat-label><input matInput type="number" formControlName="amount" /></mat-form-field>
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Date</mat-label><input matInput type="date" formControlName="date" /></mat-form-field>
      </div>
      <mat-form-field appearance="fill">
        <mat-label>Source</mat-label>
        <mat-select formControlName="source">
          @for (s of sources; track s) { <mat-option [value]="s">{{ srcLabel(s) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Received by</mat-label><input matInput formControlName="receivedBy" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>
    </form>
    <div mat-dialog-actions align="end">
      @if (existing) { <button mat-button color="warn" style="margin-right: auto;" (click)="ref.close({ action: 'delete' })">Delete</button> }
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
})
export class IncomeEditorDialog {
  ref = inject(MatDialogRef<IncomeEditorDialog>);
  private readonly fb = inject(FormBuilder);
  data: { income?: M.FinanceIncome } = inject<{ income?: M.FinanceIncome }>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  existing = !!this.data.income;
  sources = Object.values(M.FinanceIncomeSource);
  srcLabel(s: M.FinanceIncomeSource) { return M.FinanceIncomeSourceLabel[s]; }
  form = this.fb.nonNullable.group({
    title: [this.data.income?.title ?? '', [Validators.required]],
    amount: [this.data.income?.amount ?? 0, [Validators.required, Validators.min(0)]],
    date: [(this.data.income?.date ?? new Date()).toISOString().substring(0, 10)],
    source: [this.data.income?.source ?? M.FinanceIncomeSource.other],
    receivedBy: [this.data.income?.receivedBy ?? ''],
    notes: [this.data.income?.notes ?? ''],
  });
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const income: M.FinanceIncome = this.data.income
      ? { ...this.data.income, ...v, amount: Number(v.amount), date: new Date(v.date) }
      : { id: uuid(), ...v, amount: Number(v.amount), date: new Date(v.date) };
    this.ref.close({ action: 'save', income });
  }
}

@Component({
  selector: 'finances-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatTabsModule, ScreenHeaderComponent, MatDialogModule],
  template: `
    <div class="bandos-page">
      <screen-header title="Finances" [subtitle]="subtitle()"></screen-header>
      @if (locked()) {
        <div class="bandos-card" style="border-color:#C8A77B;">
          <h3 style="margin:0 0 6px;">Premium feature</h3>
          <p class="bandos-muted">Finances are available on the Premium plan.</p>
        </div>
      } @else {
        <div class="bandos-grid">
          <mat-card><h3>Income this month</h3><div class="stat">{{ incomeThisMonth() | currency:currency() }}</div></mat-card>
          <mat-card><h3>Expenses this month</h3><div class="stat">{{ expensesThisMonth() | currency:currency() }}</div></mat-card>
          <mat-card><h3>Net this month</h3><div class="stat" [style.color]="net() >= 0 ? '#7BC8A4' : '#EF4A35'">{{ net() | currency:currency() }}</div></mat-card>
          <mat-card><h3>Merch stock value</h3><div class="stat">{{ stockValue() | currency:currency() }}</div></mat-card>
        </div>

        <mat-tab-group>
          <mat-tab label="Expenses">
            <div class="bandos-toolbar" style="margin-top:14px;">
              <button mat-flat-button color="primary" (click)="newExpense()">+ New expense</button>
            </div>
            <div class="bandos-stack" style="margin-top:14px;">
              @for (e of expenses(); track e.id) {
                <mat-card (click)="editExpense(e)" style="cursor:pointer;">
                  <div class="row"><div class="r-title">{{ e.title }}</div><div class="r-amt expense">{{ e.amount | currency:currency() }}</div></div>
                  <div class="meta">{{ catLabel(e.category) }} · {{ e.date | date:'mediumDate' }} · paid by {{ e.paidBy }}</div>
                  @if (e.notes) { <div class="notes">{{ e.notes }}</div> }
                </mat-card>
              }
            </div>
          </mat-tab>
          <mat-tab label="Income">
            <div class="bandos-toolbar" style="margin-top:14px;">
              <button mat-flat-button color="primary" (click)="newIncome()">+ New income</button>
            </div>
            <div class="bandos-stack" style="margin-top:14px;">
              @for (i of incomes(); track i.id) {
                <mat-card (click)="editIncome(i)" style="cursor:pointer;">
                  <div class="row"><div class="r-title">{{ i.title }}</div><div class="r-amt income">{{ i.amount | currency:currency() }}</div></div>
                  <div class="meta">{{ srcLabel(i.source) }} · {{ i.date | date:'mediumDate' }} · {{ i.receivedBy }}</div>
                  @if (i.notes) { <div class="notes">{{ i.notes }}</div> }
                </mat-card>
              }
            </div>
          </mat-tab>
          <mat-tab label="Merch">
            <div class="bandos-stack" style="margin-top:14px;">
              @for (m of merch(); track m.id) {
                <mat-card>
                  <div class="row"><div class="r-title">{{ m.itemName }}</div><div class="r-amt">{{ stockOnHand(m) }} on hand</div></div>
                  <div class="meta">{{ m.unitPrice | currency:currency() }} per unit @if (m.unitCost) { · cost {{ m.unitCost | currency:currency() }} }</div>
                  @if (m.notes) { <div class="notes">{{ m.notes }}</div> }
                </mat-card>
              }
              @if (merch().length === 0) { <p class="bandos-muted">No merch items yet.</p> }
            </div>
          </mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
  styles: [`
    h3 { margin: 0 0 8px; font-size: 13px; color: #9D9DA7; font-weight: 600; }
    .stat { font-size: 26px; font-weight: 800; }
    .row { display: flex; justify-content: space-between; align-items: center; }
    .r-title { font-weight: 700; }
    .r-amt { font-weight: 800; }
    .r-amt.income { color: #7BC8A4; }
    .r-amt.expense { color: #EF4A35; }
    .meta { color: #9D9DA7; font-size: 12px; margin-top: 4px; }
    .notes { color: #C7C7CF; font-size: 13px; margin-top: 8px; }
  `],
})
export class FinancesComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);

  workspace = computed(() => this.wsc.workspace());
  locked = computed(() => { const w = this.workspace(); return w ? !M.wsSupportsFinances(w) : false; });
  currency = computed(() => M.WorkspaceCurrencyCode[this.workspace()?.currency ?? M.WorkspaceCurrency.eur]);
  subtitle = computed(() => this.workspace()?.bandName ?? '');

  expenses = computed(() => [...(this.workspace()?.expenses ?? [])].sort((a, b) => b.date.getTime() - a.date.getTime()));
  incomes = computed(() => [...(this.workspace()?.incomes ?? [])].sort((a, b) => b.date.getTime() - a.date.getTime()));
  merch = computed(() => this.workspace()?.merchItems ?? []);

  incomeThisMonth = computed(() => this.workspace() ? M.wsIncomeThisMonth(this.workspace()!) : 0);
  expensesThisMonth = computed(() => this.workspace() ? M.wsExpensesThisMonth(this.workspace()!) : 0);
  net = computed(() => this.workspace() ? M.wsNetThisMonth(this.workspace()!) : 0);
  stockValue = computed(() => this.merch().reduce((sum, m) => sum + M.merchStockOnHand(m) * m.unitPrice, 0));

  catLabel(c: M.FinanceExpenseCategory) { return M.FinanceExpenseCategoryLabel[c]; }
  srcLabel(s: M.FinanceIncomeSource) { return M.FinanceIncomeSourceLabel[s]; }
  stockOnHand(m: M.MerchItem) { return M.merchStockOnHand(m); }

  newExpense() {
    const ref = this.dialog.open(ExpenseEditorDialog, { data: {} });
    ref.afterClosed().subscribe(async r => {
      if (r?.action === 'save') {
        const ws = this.workspace()!;
        await this.wsc.saveFinances({ expenses: [r.expense, ...ws.expenses] });
      }
    });
  }
  editExpense(e: M.FinanceExpense) {
    const ref = this.dialog.open(ExpenseEditorDialog, { data: { expense: e } });
    ref.afterClosed().subscribe(async r => {
      const ws = this.workspace()!;
      if (r?.action === 'save') {
        const next = ws.expenses.map(x => x.id === r.expense.id ? r.expense : x);
        await this.wsc.saveFinances({ expenses: next });
      } else if (r?.action === 'delete') {
        await this.wsc.saveFinances({ expenses: ws.expenses.filter(x => x.id !== e.id) });
      }
    });
  }
  newIncome() {
    const ref = this.dialog.open(IncomeEditorDialog, { data: {} });
    ref.afterClosed().subscribe(async r => {
      if (r?.action === 'save') {
        const ws = this.workspace()!;
        await this.wsc.saveFinances({ incomes: [r.income, ...ws.incomes] });
      }
    });
  }
  editIncome(i: M.FinanceIncome) {
    const ref = this.dialog.open(IncomeEditorDialog, { data: { income: i } });
    ref.afterClosed().subscribe(async r => {
      const ws = this.workspace()!;
      if (r?.action === 'save') {
        const next = ws.incomes.map(x => x.id === r.income.id ? r.income : x);
        await this.wsc.saveFinances({ incomes: next });
      } else if (r?.action === 'delete') {
        await this.wsc.saveFinances({ incomes: ws.incomes.filter(x => x.id !== i.id) });
      }
    });
  }
}
