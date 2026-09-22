import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetBusinessProfile, useUpdateBusinessProfile, useGetSubscription, useCreateCustomerPortalSession } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, ImageIcon, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCan } from "@/hooks/use-role";

function useProfileSchema() {
  const { t } = useLanguage();
  return z.object({
    companyName: z.string().min(2, t("dashboard.profile.errors.companyNameMin")),
    vatNumber: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email(t("dashboard.profile.errors.invalidEmail")).optional().or(z.literal("")),
  });
}

type ProfileFormValues = z.infer<ReturnType<typeof useProfileSchema>>;

const ALLOWED_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"];
const MAX_SIZE_MB = 2;

export default function ProfileSettings() {
  const { t } = useLanguage();
const can = useCan();
  const profileSchema = useProfileSchema();
  const { data: profile, isLoading } = useGetBusinessProfile();
  const updateProfile = useUpdateBusinessProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscription } = useGetSubscription();
  const createPortal = useCreateCustomerPortalSession();

  const isStarter = subscription?.isActive && subscription?.plan === "monthly_starter";

  const handleUpgrade = () => {
    createPortal.mutate(undefined, {
      onSuccess: (result) => { window.open(result.url, "_blank"); },
      onError: () => toast({ title: t("dashboard.profile.errorOpenPortal"), variant: "destructive" }),
    });
  };

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLogoUrl = logoPreview ?? profile?.logoUrl ?? null;

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      companyName: profile?.companyName || "",
      vatNumber: profile?.vatNumber || "",
      address: profile?.address || "",
      phone: profile?.phone || "",
      email: profile?.email || "",
    }
  });

  const onSubmit = (data: ProfileFormValues) => {
    updateProfile.mutate({ data }, {
      onSuccess: () => {
        toast({ title: t("dashboard.profile.toast.updated") });
        queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      },
      onError: () => {
        toast({ title: t("dashboard.profile.toast.errorUpdate"), variant: "destructive" });
      }
    });
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: t("dashboard.profile.errors.unsupportedFormat"), description: t("dashboard.profile.errors.useFormats"), variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ title: t("dashboard.profile.errors.fileTooLarge"), description: t("dashboard.profile.errors.maxSize").replace("{max}", String(MAX_SIZE_MB)), variant: "destructive" });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/business-profile/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? t("dashboard.profile.errors.uploadFailed"));
      }

      const { logoUrl } = await res.json() as { logoUrl: string };
      setLogoPreview(logoUrl);
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      toast({ title: t("dashboard.profile.toast.logoUploaded") });
    } catch (err) {
      toast({
        title: t("dashboard.profile.toast.errorLogoUpload"),
        description: err instanceof Error ? err.message : t("dashboard.profile.toast.unknownError"),
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await updateProfile.mutateAsync({ data: { logoUrl: "" } });
      queryClient.invalidateQueries({ queryKey: getGetBusinessProfileQueryKey() });
      setLogoPreview(null);
      toast({ title: t("dashboard.profile.toast.logoRemoved") });
    } catch {
      toast({ title: t("dashboard.profile.toast.errorLogoRemove"), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="page-head">
          <div><Skeleton className="h-8 w-48 mb-2" /><Skeleton className="h-4 w-64" /></div>
        </div>
        <div className="card">
          <div className="card-head"><Skeleton className="h-6 w-32" /></div>
          <div className="p-5 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="page-head">
        <div>
          <h1>{t("dashboard.profile.title")}</h1>
          <p className="sub">{t("dashboard.profile.subtitle")}</p>
        </div>
      </div>

      <div className="stack">
        {/* Logo — hidden for Starter, replaced with upgrade prompt */}
        {isStarter ? (
          <div className="card" style={{ background: "linear-gradient(135deg,var(--soft),var(--teal-t))" }}>
            <div className="card-head">
              <div>
                <h2 className="flex items-center gap-2"><Crown className="h-5 w-5 text-navy-500" />{t("dashboard.profile.logoProOnly.title")}</h2>
                <p className="sub">{t("dashboard.profile.logoProOnly.desc1")}<br />{t("dashboard.profile.logoProOnly.desc2")}</p>
              </div>
            </div>
            <div className="p-5 flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                {[t("dashboard.profile.logoProOnly.feature1"), t("dashboard.profile.logoProOnly.feature2"), t("dashboard.profile.logoProOnly.feature3")].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-navy-500 font-bold">✓</span> {f}
                  </div>
                ))}
              </div>
              <Button onClick={handleUpgrade} disabled={createPortal.isPending} className="shrink-0">
                {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                {t("dashboard.profile.logoProOnly.upgradeButton")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-head">
              <div><h2>{t("dashboard.profile.logo.title")}</h2><p className="sub">{t("dashboard.profile.logo.desc")}</p></div>
            </div>
            <div className="logo-drop">
              <div className="logo-tile">
                {currentLogoUrl ? <img src={currentLogoUrl} alt={t("dashboard.profile.logo.altText")} /> : <ImageIcon className="h-6 w-6" />}
              </div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 14.5, color: "var(--navy)", display: "block" }}>
                  {currentLogoUrl ? t("dashboard.profile.logo.title") : t("dashboard.profile.logo.none")}
                </b>
                <span className="t-sub">{t("dashboard.profile.logo.formatsHint")}</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleLogoFileChange}
                disabled={isUploadingLogo}
              />
              {currentLogoUrl && (
                <button type="button" className="btn btn-outline-navy btn-sm" onClick={handleRemoveLogo} style={{ color: "var(--red)", borderColor: "var(--red)" }}>
                  <X className="h-4 w-4" /> {t("dashboard.profile.logo.remove")}
                </button>
              )}
              <button type="button" className="btn btn-outline-navy btn-sm" onClick={() => fileInputRef.current?.click()} disabled={isUploadingLogo}>
                {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isUploadingLogo ? t("dashboard.profile.logo.uploading") : t("dashboard.profile.logo.uploadButton")}
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="card">
            <div className="card-head">
              <div><h2>{t("dashboard.profile.businessData.title")}</h2><p className="sub">{t("dashboard.profile.businessData.desc")}</p></div>
            </div>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="companyName">{t("dashboard.profile.businessData.companyNameLabel")}</label>
                <input id="companyName" placeholder={t("dashboard.profile.businessData.companyNamePlaceholder")} {...register("companyName")} />
                {errors.companyName && <span className="text-xs text-destructive mt-1 block">{errors.companyName.message}</span>}
              </div>
              <div className="field">
                <label htmlFor="vatNumber">{t("dashboard.profile.businessData.vatNumberLabel")}</label>
                <input id="vatNumber" placeholder={t("dashboard.profile.businessData.vatNumberPlaceholder")} {...register("vatNumber")} />
                {errors.vatNumber && <span className="text-xs text-destructive mt-1 block">{errors.vatNumber.message}</span>}
              </div>
              <div className="field">
                <label htmlFor="phone">{t("dashboard.profile.businessData.phoneLabel")}</label>
                <input id="phone" placeholder={t("dashboard.profile.businessData.phonePlaceholder")} {...register("phone")} />
                {errors.phone && <span className="text-xs text-destructive mt-1 block">{errors.phone.message}</span>}
              </div>
              <div className="field">
                <label htmlFor="email">{t("dashboard.profile.businessData.emailLabel")}</label>
                <input id="email" type="email" placeholder={t("dashboard.profile.businessData.emailPlaceholder")} {...register("email")} />
                {errors.email && <span className="text-xs text-destructive mt-1 block">{errors.email.message}</span>}
              </div>
              <div className="field">
                <label htmlFor="address">{t("dashboard.profile.businessData.addressLabel")}</label>
                <input id="address" placeholder={t("dashboard.profile.businessData.addressPlaceholder")} {...register("address")} />
                {errors.address && <span className="text-xs text-destructive mt-1 block">{errors.address.message}</span>}
              </div>
            </div>
            <div className="card-foot" style={{ justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-navy btn-sm" disabled={updateProfile.isPending || !can("settings", "edit")} title={can("settings", "edit") ? undefined : t("roles.readOnly")}>
                {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("dashboard.profile.businessData.saveButton")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
