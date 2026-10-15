import { Component, Input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssistantContext, ChatReply, RuleBasedChatProvider } from '../../services/chat-provider';

interface ChatMessage { role: 'user' | 'assistant'; text: string; reply?: ChatReply; }

@Component({
  selector: 'app-assistant', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './assistant.component.html', styleUrl: './assistant.component.css'
})
export class AssistantComponent {
  @Input() context: AssistantContext = {
    city: '', currentAqi: null, band: null, dataStatus: 'unavailable', forecastStatus: 'unavailable', pollutants: null,
    tomorrow: null, dayAfter: null, savedProfile: null
  };

  private provider = inject(RuleBasedChatProvider);
  isOpen = signal(false);
  input = signal('');
  messages = signal<ChatMessage[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  private retryQuestion = '';

  readonly starters = [
    { label: 'Today’s AQI?', question: 'What is today’s AQI?' },
    { label: 'Highest pollutant?', question: 'Which pollutant is highest?' },
    { label: 'Tomorrow’s forecast?', question: 'What is tomorrow’s forecast?' },
    { label: 'Health guidance?', question: 'What guidance is available?' }
  ];

  toggle(): void {
    this.isOpen.update(open => !open);
    if (this.isOpen() && this.messages().length === 0) {
      const text = 'Hi! I am the SaansCast Assistant. Ask me about air quality, pollutants, forecasts, or guidance.';
      this.messages.set([{ role: 'assistant', text, reply: { text, sources: ['No dashboard data used'], dataStatus: this.context.dataStatus } }]);
    }
  }

  send(question: string): void {
    const text = question.trim();
    if (!text || this.isLoading()) return;
    this.input.set('');
    this.errorMessage.set(null);
    this.retryQuestion = text;
    this.messages.update(history => [...history, { role: 'user', text }]);
    this.answer(text);
  }

  retry(): void {
    if (this.retryQuestion) this.answer(this.retryQuestion);
  }

  private answer(question: string): void {
    this.isLoading.set(true);
    Promise.resolve().then(() => this.provider.answer(question, this.context)).then(reply => {
      this.messages.update(history => [...history, { role: 'assistant', text: reply.text, reply }]);
      this.isLoading.set(false);
    }).catch(() => {
      this.errorMessage.set('The assistant could not prepare a reply. Please retry.');
      this.isLoading.set(false);
    });
  }
}
