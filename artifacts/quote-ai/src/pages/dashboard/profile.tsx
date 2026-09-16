import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetBusinessProfile, useUpdateBusinessProfile, useGetSubscription, useCreateCustomerPortalSession } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Upload, X, ImageIcon, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBusinessProfileQueryKey } from "@workspace/api-client-react";
import { useLanguage } from "@/i18n/LanguageContext";

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

  const form = useForm<ProfileFormValues>({
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("dashboard.profile.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("dashboard.profile.subtitle")}</p>
      </div>

      {/* Logo Upload Card — hidden for Starter, replaced with upgrade prompt */}
      {isStarter ? (
        <Card className="border-navy-200 bg-gradient-to-br from-navy-50 to-teal-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-navy-500" />
              <CardTitle>{t("dashboard.profile.logoProOnly.title")}</CardTitle>
            </div>
            <CardDescription>
              {t("dashboard.profile.logoProOnly.desc1")}<br/>
              {t("dashboard.profile.logoProOnly.desc2")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                {[t("dashboard.profile.logoProOnly.feature1"), t("dashboard.profile.logoProOnly.feature2"), t("dashboard.profile.logoProOnly.feature3")].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                    <span className="text-navy-500 font-bold">✓</span> {f}
                  </div>
                ))}
              </div>
              <Button
                onClick={handleUpgrade}
                disabled={createPortal.isPending}
                className="shrink-0"
              >
                {createPortal.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Crown className="h-4 w-4 mr-2" />
                )}
                {t("dashboard.profile.logoProOnly.upgradeButton")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.profile.logo.title")}</CardTitle>
            <CardDescription>{t("dashboard.profile.logo.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Logo preview */}
              <div className="w-32 h-20 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
                {currentLogoUrl ? (
                  <img
                    src={currentLogoUrl}
                    alt={t("dashboard.profile.logo.altText")}
                    className="max-h-full max-w-full object-contain p-1"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-xs">{t("dashboard.profile.logo.none")}</span>
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleLogoFileChange}
                  disabled={isUploadingLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                  className="gap-2"
                >
                  {isUploadingLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isUploadingLogo ? t("dashboard.profile.logo.uploading") : t("dashboard.profile.logo.uploadButton")}
                </Button>
                {currentLogoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLogo}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                    {t("dashboard.profile.logo.remove")}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">{t("dashboard.profile.logo.formatsHint")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.profile.businessData.title")}</CardTitle>
              <CardDescription>{t("dashboard.profile.businessData.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("dashboard.profile.businessData.companyNameLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("dashboard.profile.businessData.companyNamePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("dashboard.profile.businessData.vatNumberLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("dashboard.profile.businessData.vatNumberPlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("dashboard.profile.businessData.phoneLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("dashboard.profile.businessData.phonePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("dashboard.profile.businessData.emailLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("dashboard.profile.businessData.emailPlaceholder")} type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("dashboard.profile.businessData.addressLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("dashboard.profile.businessData.addressPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end border-t p-6">
              <Button type="submit" disabled={updateProfile.isPending} className="min-w-[120px]">
                {updateProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("dashboard.profile.businessData.saveButton")}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
