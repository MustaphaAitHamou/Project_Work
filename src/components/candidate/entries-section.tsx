"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { initialActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import {
  deleteEducationAction,
  deleteExperienceAction,
  saveEducationAction,
  saveExperienceAction,
} from "@/app/[locale]/candidate/actions";

export interface Experience {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
}
export interface Education {
  id: string;
  degree: string;
  school: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

const month = (d: string | null) => (d ? d.slice(0, 7) : "");

function ExperienceForm({ entry, onDone }: { entry?: Experience; onDone: () => void }) {
  const t = useTranslations("candidate.experience");
  const locale = useLocale();
  const [state, action] = useActionState(saveExperienceAction, initialActionState);
  const [current, setCurrent] = useState(entry?.is_current ?? false);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  return (
    <ActionForm action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {entry && <input type="hidden" name="id" value={entry.id} />}
      {!state.ok && <FormMessage state={state} />}
      <FormField id="exp-title" label={t("title")} required>
        {(p) => <Input {...p} name="title" defaultValue={entry?.title} maxLength={150} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="exp-company" label={t("company")}>
          {(p) => <Input {...p} name="companyName" defaultValue={entry?.company_name ?? ""} maxLength={150} />}
        </FormField>
        <FormField id="exp-location" label={t("location")}>
          {(p) => <Input {...p} name="location" defaultValue={entry?.location ?? ""} maxLength={150} />}
        </FormField>
        <FormField id="exp-start" label={t("start")} required>
          {(p) => <Input {...p} name="startDate" type="month" defaultValue={month(entry?.start_date ?? null)} />}
        </FormField>
        <FormField id="exp-end" label={t("end")}>
          {(p) => <Input {...p} name="endDate" type="month" defaultValue={month(entry?.end_date ?? null)} disabled={current} />}
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isCurrent" checked={current} onChange={(e) => setCurrent(e.target.checked)} />
        {t("current")}
      </label>
      <FormField id="exp-description" label={t("description")}>
        {(p) => <Textarea {...p} name="description" defaultValue={entry?.description ?? ""} maxLength={2000} rows={4} />}
      </FormField>
      <SubmitButton className="w-full">{t("save")}</SubmitButton>
    </ActionForm>
  );
}

function EducationForm({ entry, onDone }: { entry?: Education; onDone: () => void }) {
  const t = useTranslations("candidate.education");
  const locale = useLocale();
  const [state, action] = useActionState(saveEducationAction, initialActionState);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      onDone();
    }
  }, [state, onDone]);
  return (
    <ActionForm action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {entry && <input type="hidden" name="id" value={entry.id} />}
      {!state.ok && <FormMessage state={state} />}
      <FormField id="edu-degree" label={t("degree")} required>
        {(p) => <Input {...p} name="degree" defaultValue={entry?.degree} maxLength={150} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="edu-school" label={t("school")}>
          {(p) => <Input {...p} name="school" defaultValue={entry?.school ?? ""} maxLength={150} />}
        </FormField>
        <FormField id="edu-field" label={t("field")}>
          {(p) => <Input {...p} name="fieldOfStudy" defaultValue={entry?.field_of_study ?? ""} maxLength={150} />}
        </FormField>
        <FormField id="edu-start" label={t("start")}>
          {(p) => <Input {...p} name="startDate" type="month" defaultValue={month(entry?.start_date ?? null)} />}
        </FormField>
        <FormField id="edu-end" label={t("end")}>
          {(p) => <Input {...p} name="endDate" type="month" defaultValue={month(entry?.end_date ?? null)} />}
        </FormField>
      </div>
      <FormField id="edu-description" label={t("description")}>
        {(p) => <Textarea {...p} name="description" defaultValue={entry?.description ?? ""} maxLength={1500} rows={3} />}
      </FormField>
      <SubmitButton className="w-full">{t("save")}</SubmitButton>
    </ActionForm>
  );
}

function useDialog<T>() {
  const [open, setOpen] = useState(false);
  const [entry, setEntry] = useState<T | undefined>();
  return {
    open,
    entry,
    show: (e?: T) => {
      setEntry(e);
      setOpen(true);
    },
    setOpen,
  };
}

export function ExperienceSection({ items }: { items: Experience[] }) {
  const t = useTranslations("candidate.experience");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dialog = useDialog<Experience>();
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t("sectionTitle")}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => dialog.show()}>
          <Plus aria-hidden />
          {tc("add")}
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y">
            {items.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {[e.company_name, e.location].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(e.start_date, locale, { month: "short", year: "numeric" })} –{" "}
                    {e.is_current ? t("present") : formatDate(e.end_date, locale, { month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label={tc("edit")} onClick={() => dialog.show(e)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={tc("delete")}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteExperienceAction(locale, e.id);
                        if (r.ok) toast.success(r.message);
                        else toast.error(r.message);
                      })
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{dialog.entry ? t("editTitle") : t("addTitle")}</DialogTitle>
          </DialogHeader>
          {dialog.open && <ExperienceForm entry={dialog.entry} onDone={() => dialog.setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function EducationSection({ items }: { items: Education[] }) {
  const t = useTranslations("candidate.education");
  const tc = useTranslations("common");
  const locale = useLocale();
  const dialog = useDialog<Education>();
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{t("sectionTitle")}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => dialog.show()}>
          <Plus aria-hidden />
          {tc("add")}
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="divide-y">
            {items.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{e.degree}</p>
                  <p className="text-sm text-muted-foreground">{[e.school, e.field_of_study].filter(Boolean).join(" · ")}</p>
                  {(e.start_date || e.end_date) && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.start_date, locale, { year: "numeric" })} – {formatDate(e.end_date, locale, { year: "numeric" })}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label={tc("edit")} onClick={() => dialog.show(e)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={tc("delete")}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteEducationAction(locale, e.id);
                        if (r.ok) toast.success(r.message);
                        else toast.error(r.message);
                      })
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
        <DialogContent closeLabel={tc("close")}>
          <DialogHeader>
            <DialogTitle>{dialog.entry ? t("editTitle") : t("addTitle")}</DialogTitle>
          </DialogHeader>
          {dialog.open && <EducationForm entry={dialog.entry} onDone={() => dialog.setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
