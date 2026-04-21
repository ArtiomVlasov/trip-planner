import { useState } from "react";
import { ArrowLeft, Building2, Handshake, LogIn, Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PartnerAccessProps {
  onBack: () => void;
  onLogin: () => void;
}

const PARTNER_REQUIREMENTS = [
  "Название бизнеса и формат: отель, ресторан, экскурсии, музей, трансфер, прокат и т.д.",
  "Город, адрес или территория, где вы оказываете услуги.",
  "Краткое описание предложения для путешественников и чем оно выделяется.",
  "Средний чек, ценовой сегмент и есть ли специальные условия для туристов.",
  "График работы, сезонность и доступность бронирования.",
  "Ссылки на сайт, соцсети, карты или агрегаторы с вашим профилем.",
  "Контактное лицо, телефон и email для обратной связи.",
  "Фото, меню, прайс, презентация или другие материалы, которые помогут оценить бизнес.",
];

export function PartnerAccess({ onBack, onLogin }: PartnerAccessProps) {
  const [step, setStep] = useState<"choice" | "apply">("choice");

  return (
    <>
      <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-40" onClick={onBack} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto border-white/70 bg-white shadow-2xl">
          <CardHeader className="space-y-4">
            <Button
              onClick={step === "choice" ? onBack : () => setStep("choice")}
              variant="ghost"
              className="w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {step === "choice" ? "Назад на главную" : "Назад к выбору"}
            </Button>

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              {step === "choice" ? (
                <Handshake className="h-8 w-8 text-primary" />
              ) : (
                <Building2 className="h-8 w-8 text-primary" />
              )}
            </div>

            <div className="space-y-2 text-center">
              <CardTitle>
                {step === "choice" ? "Для партнёров" : "Заявка на партнёрство"}
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                {step === "choice"
                  ? "Выберите, хотите ли вы войти в существующий партнёрский аккаунт или отправить заявку на подключение бизнеса."
                  : "Чтобы стать партнёром, отправьте письмо на Chxir@yandex.ru. Укажите основные параметры бизнеса, и мы быстрее вернёмся с ответом."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === "choice" ? (
              <>
                <Button onClick={onLogin} className="w-full" size="lg">
                  <LogIn className="mr-2 h-4 w-4" />
                  Войти
                </Button>
                <Button
                  onClick={() => setStep("apply")}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Стать партнёром
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Мы рассматриваем заявки вручную, чтобы сохранить качество рекомендаций в сервисе.
                </p>
              </>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
                  <p className="font-medium text-foreground">Что указать в письме:</p>
                  <ul className="mt-3 space-y-2">
                    {PARTNER_REQUIREMENTS.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
                  <p className="font-medium">Почта для заявки</p>
                  <a
                    href="mailto:Chxir@yandex.ru?subject=%D0%97%D0%B0%D1%8F%D0%B2%D0%BA%D0%B0%20%D0%BD%D0%B0%20%D0%BF%D0%B0%D1%80%D1%82%D0%BD%D1%91%D1%80%D1%81%D1%82%D0%B2%D0%BE%20AI%20Trip%20Planner"
                    className="mt-1 inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    Chxir@yandex.ru
                  </a>
                  <p className="mt-2 text-muted-foreground">
                    Рекомендуем тема письма: "Заявка на партнёрство AI Trip Planner".
                  </p>
                </div>

                <Button asChild className="w-full" size="lg">
                  <a href="mailto:Chxir@yandex.ru?subject=%D0%97%D0%B0%D1%8F%D0%B2%D0%BA%D0%B0%20%D0%BD%D0%B0%20%D0%BF%D0%B0%D1%80%D1%82%D0%BD%D1%91%D1%80%D1%81%D1%82%D0%B2%D0%BE%20AI%20Trip%20Planner">
                    <Mail className="mr-2 h-4 w-4" />
                    Написать на почту
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
