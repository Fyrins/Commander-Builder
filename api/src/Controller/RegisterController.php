<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class RegisterController extends AbstractController
{
    public function __construct(
        private readonly RateLimiterFactory $registrationLimiter,
        private readonly string $environment,
    ) {
    }

    #[Route('/api/register', name: 'api_register', methods: ['POST'])]
    public function __invoke(
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher,
        UserRepository $userRepository,
        ValidatorInterface $validator,
    ): JsonResponse {
        // Anti-spam d'inscriptions : limite par IP en production (voir
        // config/packages/rate_limiter.yaml). Désactivé hors prod pour ne pas
        // gêner les tests d'intégration qui créent un compte à chaque exécution.
        if ($this->environment === 'prod') {
            $limiter = $this->registrationLimiter->create($request->getClientIp() ?? 'unknown');
            if (!$limiter->consume(1)->isAccepted()) {
                return new JsonResponse(['error' => 'Trop de tentatives. Réessayez dans quelques minutes.'], 429);
            }
        }

        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return new JsonResponse(['error' => 'Corps de requête JSON invalide.'], 400);
        }

        $username = trim((string) ($payload['username'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        $violations = $validator->validate($username, [
            new Assert\NotBlank(message: 'Le pseudonyme est obligatoire.'),
            new Assert\Length(
                min: 3,
                max: 30,
                minMessage: 'Le pseudonyme doit contenir au moins {{ limit }} caractères.',
                maxMessage: 'Le pseudonyme doit contenir au maximum {{ limit }} caractères.',
            ),
            new Assert\Regex(
                pattern: '/^[A-Za-z0-9_-]+$/',
                message: 'Le pseudonyme ne peut contenir que des lettres, chiffres, tirets et underscores.',
            ),
        ]);
        if (count($violations) > 0) {
            return new JsonResponse(['error' => (string) $violations[0]->getMessage()], 400);
        }

        if (strlen($password) < 8) {
            return new JsonResponse(['error' => 'Le mot de passe doit contenir au moins 8 caractères.'], 400);
        }

        if ($userRepository->findOneBy(['username' => $username]) !== null) {
            return new JsonResponse(['error' => 'Ce pseudonyme est déjà utilisé.'], 409);
        }

        $user = new User();
        $user->setUsername($username);
        $user->setRoles(['ROLE_USER']);
        $user->setPassword($passwordHasher->hashPassword($user, $password));

        $entityManager->persist($user);
        $entityManager->flush();

        return new JsonResponse(['id' => $user->getId(), 'username' => $user->getUsername()], 201);
    }
}
