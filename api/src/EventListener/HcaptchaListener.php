<?php

namespace App\EventListener;

use App\Service\HcaptchaVerifier;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

/**
 * Exige un token hCaptcha valide sur l'inscription et la connexion. S'exécute
 * avant le firewall de sécurité (priorité élevée) : un token absent ou invalide
 * court-circuite la requête sans même tenter l'authentification.
 *
 * Actif en production uniquement — en dev/test, l'absence de clés réelles et
 * les scripts (seed, tests d'intégration) ne doivent pas être bloqués.
 */
#[AsEventListener(event: KernelEvents::REQUEST, priority: 20)]
class HcaptchaListener
{
    /** @var array<string> Chemins protégés (POST) */
    private const PROTECTED_PATHS = ['/api/register', '/api/login'];

    public function __construct(
        private readonly HcaptchaVerifier $verifier,
        private readonly string $environment,
    ) {
    }

    public function __invoke(RequestEvent $event): void
    {
        if ($this->environment !== 'prod' || !$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();
        if ($request->getMethod() !== 'POST' || !in_array($request->getPathInfo(), self::PROTECTED_PATHS, true)) {
            return;
        }

        $payload = json_decode($request->getContent(), true);
        $token = is_array($payload) ? ($payload['hcaptchaToken'] ?? null) : null;

        if (!$this->verifier->verify(is_string($token) ? $token : null, $request->getClientIp())) {
            $event->setResponse(new JsonResponse(
                ['code' => Response::HTTP_BAD_REQUEST, 'message' => 'Vérification anti-robot échouée. Merci de recommencer.'],
                Response::HTTP_BAD_REQUEST,
            ));
        }
    }
}
